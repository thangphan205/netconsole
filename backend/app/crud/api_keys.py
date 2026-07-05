import secrets
from datetime import UTC, datetime

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.core.security import pwd_context
from app.models import ApiKey, ApiKeyCreate, User

_PREFIX_LEN = 12


def generate_raw_key() -> str:
    return f"ncmcp_{secrets.token_urlsafe(32)}"


def _create_service_account(session: Session) -> User:
    service_user = User(
        email=f"apikey-{secrets.token_hex(4)}@service.netconsole.local",
        is_superuser=True,
        is_active=True,
        password_login_enabled=False,
        hashed_password=None,
        is_service_account=True,
    )
    session.add(service_user)
    session.commit()
    session.refresh(service_user)
    return service_user


def create_api_key(
    *, session: Session, key_in: ApiKeyCreate, owner_id: int
) -> tuple[ApiKey, str]:
    user_id = key_in.user_id
    if user_id is None:
        user_id = _create_service_account(session).id

    raw_key = generate_raw_key()
    api_key = ApiKey(
        name=key_in.name,
        expires_at=key_in.expires_at,
        role=key_in.role,
        prefix=raw_key[:_PREFIX_LEN],
        hashed_key=pwd_context.hash(raw_key),
        user_id=user_id,
    )
    session.add(api_key)
    session.commit()
    session.refresh(api_key)
    return api_key, raw_key


def get_api_keys(session: Session, skip: int = 0, limit: int = 200) -> list[ApiKey]:
    return list(session.exec(select(ApiKey).offset(skip).limit(limit)).all())


def get_api_keys_count(session: Session) -> int:
    return len(session.exec(select(ApiKey)).all())


def get_api_key_by_id(session: Session, id: int) -> ApiKey | None:
    return session.get(ApiKey, id)


def authenticate_api_key(session: Session, raw_key: str) -> ApiKey | None:
    prefix = raw_key[:_PREFIX_LEN]
    candidates = session.exec(
        select(ApiKey).where(ApiKey.prefix == prefix, ApiKey.is_active == True)  # noqa: E712
    ).all()
    for candidate in candidates:
        if not pwd_context.verify(raw_key, candidate.hashed_key):
            continue
        if candidate.expires_at and candidate.expires_at < datetime.now(UTC).replace(
            tzinfo=None
        ):
            return None
        return candidate
    return None


def touch_last_used(session: Session, api_key: ApiKey) -> None:
    api_key.last_used_at = datetime.now(UTC)
    session.add(api_key)
    session.commit()


def revoke_api_key(session: Session, api_key: ApiKey) -> User | None:
    """Delete the key; clean up its backing service account if orphaned.

    The service account is hard-deleted unless some other row (e.g. an Item
    it created) still references it, in which case it's deactivated instead
    so it can never authenticate again without leaving a dangling FK.
    """
    user_id = api_key.user_id
    session.delete(api_key)
    session.commit()

    user = session.get(User, user_id)
    if user and user.is_service_account:
        remaining = session.exec(
            select(ApiKey).where(ApiKey.user_id == user_id)
        ).first()
        if remaining is None:
            try:
                session.delete(user)
                session.commit()
                return user
            except IntegrityError:
                session.rollback()
                user = session.get(User, user_id)
                if user:
                    user.is_active = False
                    session.add(user)
                    session.commit()
                return user
    return None
