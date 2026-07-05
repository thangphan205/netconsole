from datetime import UTC, datetime, timedelta

from sqlmodel import Session

from app.crud.api_keys import (
    authenticate_api_key,
    create_api_key,
    revoke_api_key,
)
from app.crud.users import create_user
from app.models import ApiKeyCreate, User, UserCreate
from app.tests.utils.utils import random_email, random_lower_string


def _make_user(db: Session):
    user_in = UserCreate(email=random_email(), password=random_lower_string())
    return create_user(session=db, user_create=user_in)


def test_create_api_key_explicit_user_id(db: Session) -> None:
    user = _make_user(db)
    api_key, raw_key = create_api_key(
        session=db, key_in=ApiKeyCreate(name="test", user_id=user.id), owner_id=user.id
    )
    assert api_key.user_id == user.id
    assert raw_key.startswith("ncmcp_")
    assert api_key.hashed_key != raw_key
    assert api_key.prefix == raw_key[:12]


def test_create_api_key_auto_provisions_service_account(db: Session) -> None:
    owner = _make_user(db)
    api_key, _ = create_api_key(
        session=db, key_in=ApiKeyCreate(name="test"), owner_id=owner.id
    )
    assert api_key.user_id != owner.id
    service_user = db.get(User, api_key.user_id)
    assert service_user is not None
    assert service_user.is_service_account is True
    assert service_user.is_superuser is True
    assert service_user.is_active is True
    assert service_user.password_login_enabled is False
    assert service_user.hashed_password is None


def test_create_api_key_default_role_is_read_write(db: Session) -> None:
    owner = _make_user(db)
    api_key, _ = create_api_key(
        session=db, key_in=ApiKeyCreate(name="test"), owner_id=owner.id
    )
    assert api_key.role == "read_write"


def test_create_api_key_explicit_role_read_only(db: Session) -> None:
    owner = _make_user(db)
    api_key, _ = create_api_key(
        session=db,
        key_in=ApiKeyCreate(name="test", role="read_only"),
        owner_id=owner.id,
    )
    assert api_key.role == "read_only"


def test_authenticate_api_key(db: Session) -> None:
    owner = _make_user(db)
    _, raw_key = create_api_key(
        session=db, key_in=ApiKeyCreate(name="test"), owner_id=owner.id
    )
    found = authenticate_api_key(db, raw_key)
    assert found is not None


def test_authenticate_api_key_wrong_key(db: Session) -> None:
    owner = _make_user(db)
    create_api_key(session=db, key_in=ApiKeyCreate(name="test"), owner_id=owner.id)
    assert authenticate_api_key(db, "ncmcp_not-a-real-key") is None


def test_authenticate_api_key_expired(db: Session) -> None:
    owner = _make_user(db)
    _, raw_key = create_api_key(
        session=db,
        key_in=ApiKeyCreate(
            name="test", expires_at=datetime.now(UTC) - timedelta(days=1)
        ),
        owner_id=owner.id,
    )
    assert authenticate_api_key(db, raw_key) is None


def test_revoke_api_key(db: Session) -> None:
    owner = _make_user(db)
    api_key, raw_key = create_api_key(
        session=db, key_in=ApiKeyCreate(name="test"), owner_id=owner.id
    )
    revoke_api_key(db, api_key)
    assert authenticate_api_key(db, raw_key) is None


def test_revoke_api_key_cleans_up_service_account(db: Session) -> None:
    owner = _make_user(db)
    api_key, _ = create_api_key(
        session=db, key_in=ApiKeyCreate(name="test"), owner_id=owner.id
    )
    service_user_id = api_key.user_id
    revoke_api_key(db, api_key)
    assert db.get(User, service_user_id) is None


def test_revoke_api_key_explicit_user_id_not_cleaned_up(db: Session) -> None:
    human = _make_user(db)
    api_key, _ = create_api_key(
        session=db,
        key_in=ApiKeyCreate(name="test", user_id=human.id),
        owner_id=human.id,
    )
    revoke_api_key(db, api_key)
    assert db.get(User, human.id) is not None


def test_revoke_api_key_shared_service_account_not_deleted_prematurely(
    db: Session,
) -> None:
    owner = _make_user(db)
    api_key_1, _ = create_api_key(
        session=db, key_in=ApiKeyCreate(name="key1"), owner_id=owner.id
    )
    shared_user_id = api_key_1.user_id
    api_key_2, _ = create_api_key(
        session=db,
        key_in=ApiKeyCreate(name="key2", user_id=shared_user_id),
        owner_id=owner.id,
    )
    revoke_api_key(db, api_key_1)
    assert db.get(User, shared_user_id) is not None
    revoke_api_key(db, api_key_2)
    assert db.get(User, shared_user_id) is None
