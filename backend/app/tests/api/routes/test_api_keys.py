from fastapi.testclient import TestClient

from app.core.config import settings


def test_create_and_list_api_key(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/api-keys/",
        headers=superuser_token_headers,
        json={"name": "test-key"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "test-key"
    assert data["key"].startswith("ncmcp_")
    key_id = data["id"]

    r2 = client.get(
        f"{settings.API_V1_STR}/api-keys/", headers=superuser_token_headers
    )
    assert r2.status_code == 200
    listed = r2.json()["data"]
    assert any(k["id"] == key_id for k in listed)
    assert all("hashed_key" not in k for k in listed)

    client.delete(
        f"{settings.API_V1_STR}/api-keys/{key_id}", headers=superuser_token_headers
    )


def test_api_key_authenticates_requests(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/api-keys/",
        headers=superuser_token_headers,
        json={"name": "mcp-test"},
    )
    raw_key = r.json()["key"]
    key_id = r.json()["id"]

    r2 = client.get(
        f"{settings.API_V1_STR}/users/me", headers={"X-API-Key": raw_key}
    )
    assert r2.status_code == 200

    r3 = client.get(
        f"{settings.API_V1_STR}/users/me", headers={"X-API-Key": "ncmcp_bogus"}
    )
    assert r3.status_code == 401

    client.delete(
        f"{settings.API_V1_STR}/api-keys/{key_id}", headers=superuser_token_headers
    )

    r4 = client.get(
        f"{settings.API_V1_STR}/users/me", headers={"X-API-Key": raw_key}
    )
    assert r4.status_code == 401


def test_revoke_api_key(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/api-keys/",
        headers=superuser_token_headers,
        json={"name": "to-revoke"},
    )
    key_id = r.json()["id"]

    r2 = client.delete(
        f"{settings.API_V1_STR}/api-keys/{key_id}", headers=superuser_token_headers
    )
    assert r2.status_code == 200


def test_api_keys_requires_superuser(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/api-keys/",
        headers=normal_user_token_headers,
        json={"name": "nope"},
    )
    assert r.status_code == 403


def test_api_keys_requires_auth(client: TestClient) -> None:
    r = client.get(f"{settings.API_V1_STR}/api-keys/")
    assert r.status_code == 401
