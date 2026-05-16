import hashlib
import secrets
from base64 import urlsafe_b64encode
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any, cast

import httpx
from authlib.integrations.httpx_client import AsyncOAuth2Client
from fastapi import APIRouter, Cookie, HTTPException
from fastapi.responses import RedirectResponse
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from app.api.deps import SessionDep
from app.core import security
from app.core.config import settings
from app.crud.audit import write_audit_log
from app.crud.oauth import get_or_create_user_from_oauth

router = APIRouter()

_STATE_MAX_AGE = 600  # 10 minutes


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(settings.SECRET_KEY, salt="oauth-state")


def _provider_config(provider: str) -> dict[str, Any]:
    if provider == "google":
        return {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "discovery_url": "https://accounts.google.com/.well-known/openid-configuration",
            "scope": "openid email profile",
        }
    elif provider == "microsoft":
        tenant = settings.MICROSOFT_TENANT_ID
        return {
            "client_id": settings.MICROSOFT_CLIENT_ID,
            "client_secret": settings.MICROSOFT_CLIENT_SECRET,
            "discovery_url": f"https://login.microsoftonline.com/{tenant}/v2.0/.well-known/openid-configuration",
            "scope": "openid email profile",
        }
    elif provider == "keycloak":
        return {
            "client_id": settings.KEYCLOAK_CLIENT_ID,
            "client_secret": settings.KEYCLOAK_CLIENT_SECRET,
            "discovery_url": f"{settings.KEYCLOAK_SERVER_URL}/realms/{settings.KEYCLOAK_REALM}/.well-known/openid-configuration",
            "scope": "openid email profile",
        }
    raise HTTPException(status_code=404, detail="Unknown provider")


async def _fetch_oidc_config(discovery_url: str) -> dict[str, Any]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(discovery_url)
        resp.raise_for_status()
        return cast(dict[str, Any], resp.json())


def _callback_url(provider: str) -> str:
    return f"{settings.server_host}/api/v1/auth/{provider}/callback"


@router.get("/providers")
def list_providers() -> dict[str, Any]:
    return {"providers": settings.enabled_oauth_providers}


@router.get("/{provider}/login")
async def oauth_login(provider: str) -> RedirectResponse:
    if provider not in settings.enabled_oauth_providers:
        raise HTTPException(status_code=404, detail="Provider not configured")

    cfg = _provider_config(provider)
    oidc = await _fetch_oidc_config(cfg["discovery_url"])
    authorize_url = oidc["authorization_endpoint"]

    state = secrets.token_urlsafe(32)
    code_verifier = secrets.token_urlsafe(32)
    digest = hashlib.sha256(code_verifier.encode()).digest()
    code_challenge = urlsafe_b64encode(digest).rstrip(b"=").decode()

    signed = _serializer().dumps(
        {"state": state, "code_verifier": code_verifier, "provider": provider}
    )

    async with AsyncOAuth2Client(
        client_id=cfg["client_id"],
        redirect_uri=_callback_url(provider),
        scope=cfg["scope"],
        code_challenge_method="S256",
    ) as client:
        url, _ = client.create_authorization_url(
            authorize_url,
            state=state,
            code_challenge=code_challenge,
            code_challenge_method="S256",
        )

    response = RedirectResponse(url=url)
    response.set_cookie(
        "__oauth_state",
        signed,
        max_age=_STATE_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=(settings.ENVIRONMENT != "local"),
    )
    return response


@router.get("/{provider}/callback")
async def oauth_callback(
    provider: str,
    code: str,
    state: str,
    session: SessionDep,
    __oauth_state: Annotated[str | None, Cookie()] = None,
) -> RedirectResponse:
    frontend = settings.server_host

    def error_redirect(reason: str) -> RedirectResponse:
        r = RedirectResponse(url=f"{frontend}/login?error={reason}")
        r.delete_cookie("__oauth_state")
        return r

    if not __oauth_state:
        return error_redirect("session_expired")

    try:
        data = _serializer().loads(__oauth_state, max_age=_STATE_MAX_AGE)
    except (SignatureExpired, BadSignature):
        return error_redirect("session_expired")

    if data.get("state") != state or data.get("provider") != provider:
        return error_redirect("state_mismatch")

    code_verifier: str = data["code_verifier"]

    if provider not in settings.enabled_oauth_providers:
        return error_redirect("provider_disabled")

    cfg = _provider_config(provider)
    oidc = await _fetch_oidc_config(cfg["discovery_url"])
    token_endpoint: str = oidc["token_endpoint"]

    try:
        async with AsyncOAuth2Client(
            client_id=cfg["client_id"],
            client_secret=cfg["client_secret"],
            redirect_uri=_callback_url(provider),
        ) as client:
            token = await client.fetch_token(
                token_endpoint,
                code=code,
                code_verifier=code_verifier,
            )

        userinfo_endpoint: str = oidc["userinfo_endpoint"]
        async with httpx.AsyncClient() as hc:
            ui_resp = await hc.get(
                userinfo_endpoint,
                headers={"Authorization": f"Bearer {token['access_token']}"},
            )
            ui_resp.raise_for_status()
            claims = ui_resp.json()
    except Exception:
        return error_redirect("token_exchange_failed")

    sub: str = claims.get("sub", "")
    email: str = claims.get("email", "")
    full_name: str | None = claims.get("name")

    if not sub or not email:
        return error_redirect("missing_user_info")

    expires_at: datetime | None = None
    if token.get("expires_at"):
        expires_at = datetime.fromtimestamp(token["expires_at"], tz=timezone.utc)

    user = get_or_create_user_from_oauth(
        session=session,
        provider=provider,
        provider_user_id=sub,
        email=email,
        full_name=full_name,
        access_token=token.get("access_token"),
        refresh_token=token.get("refresh_token"),
        expires_at=expires_at,
    )

    if not user.is_active:
        write_audit_log(
            session,
            username=email,
            action="oauth_login_failed",
            message=f"Inactive user via {provider}",
            severity="ERROR",
        )
        return error_redirect("user_inactive")

    access_token = security.create_access_token(
        subject=user.id,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    write_audit_log(
        session,
        username=email,
        action="oauth_login_success",
        message=f"Logged in via {provider}",
    )

    response = RedirectResponse(url=f"{frontend}/oauth-callback?token={access_token}")
    response.delete_cookie("__oauth_state")
    return response
