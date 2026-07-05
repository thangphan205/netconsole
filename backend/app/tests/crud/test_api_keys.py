from datetime import UTC, datetime, timedelta

from sqlmodel import Session

from app.crud.api_keys import (
    authenticate_api_key,
    create_api_key,
    revoke_api_key,
)
from app.crud.users import create_user
from app.models import ApiKeyCreate, UserCreate
from app.tests.utils.utils import random_email, random_lower_string


def _make_user(db: Session):
    user_in = UserCreate(email=random_email(), password=random_lower_string())
    return create_user(session=db, user_create=user_in)


def test_create_api_key(db: Session) -> None:
    user = _make_user(db)
    api_key, raw_key = create_api_key(
        session=db, key_in=ApiKeyCreate(name="test"), owner_id=user.id
    )
    assert api_key.user_id == user.id
    assert raw_key.startswith("ncmcp_")
    assert api_key.hashed_key != raw_key
    assert api_key.prefix == raw_key[:12]


def test_authenticate_api_key(db: Session) -> None:
    user = _make_user(db)
    _, raw_key = create_api_key(
        session=db, key_in=ApiKeyCreate(name="test"), owner_id=user.id
    )
    found = authenticate_api_key(db, raw_key)
    assert found is not None
    assert found.user_id == user.id


def test_authenticate_api_key_wrong_key(db: Session) -> None:
    user = _make_user(db)
    create_api_key(session=db, key_in=ApiKeyCreate(name="test"), owner_id=user.id)
    assert authenticate_api_key(db, "ncmcp_not-a-real-key") is None


def test_authenticate_api_key_expired(db: Session) -> None:
    user = _make_user(db)
    _, raw_key = create_api_key(
        session=db,
        key_in=ApiKeyCreate(
            name="test", expires_at=datetime.now(UTC) - timedelta(days=1)
        ),
        owner_id=user.id,
    )
    assert authenticate_api_key(db, raw_key) is None


def test_revoke_api_key(db: Session) -> None:
    user = _make_user(db)
    api_key, raw_key = create_api_key(
        session=db, key_in=ApiKeyCreate(name="test"), owner_id=user.id
    )
    revoke_api_key(db, api_key)
    assert authenticate_api_key(db, raw_key) is None
