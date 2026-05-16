from fastapi.testclient import TestClient

from app.core.config import settings
from app.tests.utils.utils import random_lower_string


def test_read_credentials(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.get(
        f"{settings.API_V1_STR}/credentials/", headers=superuser_token_headers
    )
    assert r.status_code == 200
    data = r.json()
    assert "data" in data
    assert "count" in data


def test_create_credential(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    payload = {
        "username": f"user_{random_lower_string()[:8]}",
        "password": random_lower_string(),
        "description": "test cred",
    }
    r = client.post(
        f"{settings.API_V1_STR}/credentials/",
        headers=superuser_token_headers,
        json=payload,
    )
    assert r.status_code == 200
    cred = r.json()
    assert cred["username"] == payload["username"]
    assert "id" in cred
    client.delete(
        f"{settings.API_V1_STR}/credentials/{cred['id']}",
        headers=superuser_token_headers,
    )


def test_read_credential(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    payload = {"username": f"user_{random_lower_string()[:8]}", "password": "pass"}
    r = client.post(
        f"{settings.API_V1_STR}/credentials/",
        headers=superuser_token_headers,
        json=payload,
    )
    cred_id = r.json()["id"]
    r2 = client.get(
        f"{settings.API_V1_STR}/credentials/{cred_id}",
        headers=superuser_token_headers,
    )
    assert r2.status_code == 200
    assert r2.json()["id"] == cred_id
    client.delete(
        f"{settings.API_V1_STR}/credentials/{cred_id}",
        headers=superuser_token_headers,
    )


def test_read_credential_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.get(
        f"{settings.API_V1_STR}/credentials/999999",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404


def test_update_credential(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    payload = {"username": f"user_{random_lower_string()[:8]}", "password": "old"}
    r = client.post(
        f"{settings.API_V1_STR}/credentials/",
        headers=superuser_token_headers,
        json=payload,
    )
    cred_id = r.json()["id"]
    r2 = client.put(
        f"{settings.API_V1_STR}/credentials/{cred_id}",
        headers=superuser_token_headers,
        json={"description": "updated"},
    )
    assert r2.status_code == 200
    assert r2.json()["description"] == "updated"
    client.delete(
        f"{settings.API_V1_STR}/credentials/{cred_id}",
        headers=superuser_token_headers,
    )


def test_delete_credential(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    payload = {"username": f"user_{random_lower_string()[:8]}", "password": "pass"}
    r = client.post(
        f"{settings.API_V1_STR}/credentials/",
        headers=superuser_token_headers,
        json=payload,
    )
    cred_id = r.json()["id"]
    r2 = client.delete(
        f"{settings.API_V1_STR}/credentials/{cred_id}",
        headers=superuser_token_headers,
    )
    assert r2.status_code == 200
    r3 = client.get(
        f"{settings.API_V1_STR}/credentials/{cred_id}",
        headers=superuser_token_headers,
    )
    assert r3.status_code == 404


def test_credentials_requires_auth(client: TestClient) -> None:
    r = client.get(f"{settings.API_V1_STR}/credentials/")
    assert r.status_code == 401
