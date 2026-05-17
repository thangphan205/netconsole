import json
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any, cast

from fastapi import APIRouter, Cookie, HTTPException
from fastapi.responses import JSONResponse, Response
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlmodel import SQLModel, select
from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers import base64url_to_bytes, bytes_to_base64url
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from app.api.deps import CurrentUser, SessionDep
from app.core import security
from app.core.config import settings
from app.crud.audit import write_audit_log
from app.models import (
    Message,
    Token,
    User,
    WebAuthnCredential,
    WebAuthnCredentialPublic,
)

router = APIRouter()

_CHALLENGE_MAX_AGE = 300  # 5 minutes


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(settings.SECRET_KEY, salt="webauthn-challenge")


def _sign_challenge(challenge_b64: str, user_id: int) -> str:
    return _serializer().dumps({"challenge": challenge_b64, "user_id": user_id})


def _load_challenge(cookie: str) -> dict[str, Any]:
    return cast(dict[str, Any], _serializer().loads(cookie, max_age=_CHALLENGE_MAX_AGE))


def _cookie_kwargs() -> dict[str, Any]:
    return {
        "httponly": True,
        "samesite": "lax",
        "secure": settings.ENVIRONMENT != "local",
    }


# ── Request body schemas ───────────────────────────────────────────────────────


class RegisterCompleteBody(SQLModel):
    credential: dict[str, Any]
    name: str | None = None


class LoginBeginBody(SQLModel):
    email: str | None = None


# ── Registration (authenticated user adds a passkey) ──────────────────────────


@router.post("/register/begin")
async def passkey_register_begin(current_user: CurrentUser) -> Any:
    options = generate_registration_options(
        rp_id=settings.WEBAUTHN_RP_ID,
        rp_name=settings.WEBAUTHN_RP_NAME,
        user_id=str(current_user.id).encode(),
        user_name=current_user.email,
        user_display_name=current_user.full_name or current_user.email,
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.PREFERRED,
        ),
    )

    challenge_b64 = bytes_to_base64url(options.challenge)
    signed = _sign_challenge(challenge_b64, current_user.id)  # type: ignore[arg-type]

    resp = Response(content=options_to_json(options), media_type="application/json")
    resp.set_cookie("__wn_reg", signed, max_age=_CHALLENGE_MAX_AGE, **_cookie_kwargs())
    return resp


@router.post("/register/complete")
async def passkey_register_complete(
    body: RegisterCompleteBody,
    current_user: CurrentUser,
    session: SessionDep,
    __wn_reg: Annotated[str | None, Cookie()] = None,
) -> Any:
    if not __wn_reg:
        raise HTTPException(status_code=400, detail="Registration session expired")

    try:
        data = _load_challenge(__wn_reg)
    except (SignatureExpired, BadSignature):
        raise HTTPException(status_code=400, detail="Registration session expired")

    if data["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="User mismatch")

    expected_challenge = base64url_to_bytes(data["challenge"])

    try:
        verification = verify_registration_response(
            credential=json.dumps(body.credential),
            expected_challenge=expected_challenge,
            expected_rp_id=settings.WEBAUTHN_RP_ID,
            expected_origin=settings.WEBAUTHN_ORIGIN,
            require_user_verification=False,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Registration failed: {exc}")

    device_type = (
        verification.credential_device_type.value
        if hasattr(verification.credential_device_type, "value")
        else str(verification.credential_device_type)
        if verification.credential_device_type
        else None
    )

    credential = WebAuthnCredential(
        user_id=current_user.id,
        credential_id=bytes_to_base64url(verification.credential_id),
        public_key=bytes_to_base64url(verification.credential_public_key),
        sign_count=verification.sign_count,
        device_type=device_type,
        backed_up=verification.credential_backed_up,
        aaguid=str(verification.aaguid) if verification.aaguid else None,
        name=body.name,
    )
    session.add(credential)
    session.commit()

    write_audit_log(
        session,
        username=current_user.email,
        action="passkey_register",
        message=f"Registered passkey '{body.name or 'unnamed'}'",
    )

    resp = JSONResponse(content={"ok": True})
    resp.delete_cookie("__wn_reg")
    return resp


# ── Authentication (unauthenticated — produces a JWT) ─────────────────────────


@router.post("/login/begin")
async def passkey_login_begin(body: LoginBeginBody, session: SessionDep) -> Any:
    allow_credentials: list[PublicKeyCredentialDescriptor] = []

    if body.email:
        user = session.exec(select(User).where(User.email == body.email)).first()
        if user:
            creds = session.exec(
                select(WebAuthnCredential).where(WebAuthnCredential.user_id == user.id)
            ).all()
            allow_credentials = [
                PublicKeyCredentialDescriptor(id=base64url_to_bytes(c.credential_id))
                for c in creds
            ]

    options = generate_authentication_options(
        rp_id=settings.WEBAUTHN_RP_ID,
        allow_credentials=allow_credentials,
        user_verification=UserVerificationRequirement.PREFERRED,
    )

    challenge_b64 = bytes_to_base64url(options.challenge)
    signed = _sign_challenge(challenge_b64, 0)

    resp = Response(content=options_to_json(options), media_type="application/json")
    resp.set_cookie("__wn_auth", signed, max_age=_CHALLENGE_MAX_AGE, **_cookie_kwargs())
    return resp


@router.post("/login/complete")
async def passkey_login_complete(
    body: dict[str, Any],
    session: SessionDep,
    __wn_auth: Annotated[str | None, Cookie()] = None,
) -> Token:
    if not __wn_auth:
        raise HTTPException(status_code=400, detail="Authentication session expired")

    try:
        data = _load_challenge(__wn_auth)
    except (SignatureExpired, BadSignature):
        raise HTTPException(status_code=400, detail="Authentication session expired")

    expected_challenge = base64url_to_bytes(data["challenge"])
    credential_id_b64: str = body.get("rawId") or body.get("id", "")

    credential_row = session.exec(
        select(WebAuthnCredential).where(
            WebAuthnCredential.credential_id == credential_id_b64
        )
    ).first()

    if not credential_row:
        raise HTTPException(status_code=404, detail="Credential not found")

    try:
        verification = verify_authentication_response(
            credential=json.dumps(body),
            expected_challenge=expected_challenge,
            expected_rp_id=settings.WEBAUTHN_RP_ID,
            expected_origin=settings.WEBAUTHN_ORIGIN,
            credential_public_key=base64url_to_bytes(credential_row.public_key),
            credential_current_sign_count=credential_row.sign_count,
            require_user_verification=False,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Authentication failed: {exc}")

    if verification.new_sign_count < credential_row.sign_count:
        raise HTTPException(
            status_code=403,
            detail="Sign count regression — possible cloned authenticator",
        )

    credential_row.sign_count = verification.new_sign_count
    credential_row.last_used_at = datetime.now(UTC)
    session.add(credential_row)
    session.commit()

    user = session.get(User, credential_row.user_id)
    if not user or not user.is_active:
        username = user.email if user else f"user_id:{credential_row.user_id}"
        write_audit_log(
            session,
            username=username,
            action="passkey_login_failed",
            message="Passkey login: user inactive",
            severity="ERROR",
        )
        raise HTTPException(status_code=400, detail="User inactive")

    write_audit_log(
        session,
        username=user.email,
        action="passkey_login_success",
        message="Logged in via passkey",
    )

    access_token = security.create_access_token(
        subject=user.id,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return Token(access_token=access_token)


# ── Credential management ─────────────────────────────────────────────────────


@router.get("/credentials")
def list_credentials(
    current_user: CurrentUser,
    session: SessionDep,
) -> list[WebAuthnCredentialPublic]:
    creds = session.exec(
        select(WebAuthnCredential).where(WebAuthnCredential.user_id == current_user.id)
    ).all()
    return [WebAuthnCredentialPublic.model_validate(c) for c in creds]


@router.delete("/credentials/{credential_id}")
def delete_credential(
    credential_id: int,
    current_user: CurrentUser,
    session: SessionDep,
) -> Message:
    cred = session.get(WebAuthnCredential, credential_id)
    if not cred or cred.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Credential not found")
    name = cred.name or "unnamed"
    session.delete(cred)
    session.commit()
    write_audit_log(
        session,
        username=current_user.email,
        action="passkey_delete",
        message=f"Deleted passkey '{name}'",
        severity="WARNING",
    )
    return Message(message="Credential deleted")
