from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, delete

from app.core.config import settings
from app.core.db import engine, init_db
from app.main import app
from app.models import (
    ApiKey,
    Arp,
    Credential,
    Group,
    IpInterface,
    Item,
    MacAddress,
    OAuthAccount,
    Switch,
    User,
    WebAuthnCredential,
)
from app.tests.utils.user import authentication_token_from_email
from app.tests.utils.utils import get_superuser_token_headers


@pytest.fixture(scope="session", autouse=True)
def db() -> Generator[Session]:
    with Session(engine) as session:
        init_db(session)
        yield session
        session.execute(delete(ApiKey))
        session.execute(delete(Arp))
        session.execute(delete(MacAddress))
        session.execute(delete(IpInterface))
        session.execute(delete(Credential))
        session.execute(delete(Group))
        session.execute(delete(Switch))
        session.execute(delete(WebAuthnCredential))
        session.execute(delete(OAuthAccount))
        session.execute(delete(Item))
        session.execute(delete(User))
        session.commit()


@pytest.fixture(scope="module")
def client() -> Generator[TestClient]:
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def superuser_token_headers(client: TestClient) -> dict[str, str]:
    return get_superuser_token_headers(client)


@pytest.fixture(scope="module")
def normal_user_token_headers(client: TestClient, db: Session) -> dict[str, str]:
    return authentication_token_from_email(
        client=client, email=settings.EMAIL_TEST_USER, db=db
    )
