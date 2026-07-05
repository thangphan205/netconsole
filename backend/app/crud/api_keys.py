import secrets
from datetime import UTC, datetime

from sqlmodel import Session, select

from app.core.security import pwd_context
from app.models import ApiKey, ApiKeyCreate

_PREFIX_LEN = 12


def generate_raw_key() -> str:
    return f"ncmcp_{secrets.token_urlsafe(32)}"


def create_api_key(
    *, session: Session, key_in: ApiKeyCreate, owner_id: int
) -> tuple[ApiKey, str]:
    raw_key = generate_raw_key()
    api_key = ApiKey(
        name=key_in.name,
        expires_at=key_in.expires_at,
        prefix=raw_key[:_PREFIX_LEN],
        hashed_key=pwd_context.hash(raw_key),
        user_id=key_in.user_id or owner_id,
    )
    session.add(api_key)
    session.commit()
    session.refresh(api_key)
    return api_key, raw_key


def get_api_keys(session: Session, skip: int = 0, limit: int = 200) -> list[ApiKey]:
    return session.exec(select(ApiKey).offset(skip).limit(limit)).all()


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


def revoke_api_key(session: Session, api_key: ApiKey) -> None:
    session.delete(api_key)
    session.commit()
