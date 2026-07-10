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

    r2 = client.get(f"{settings.API_V1_STR}/api-keys/", headers=superuser_token_headers)
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

    r2 = client.get(f"{settings.API_V1_STR}/users/me", headers={"X-API-Key": raw_key})
    assert r2.status_code == 200

    r3 = client.get(
        f"{settings.API_V1_STR}/users/me", headers={"X-API-Key": "ncmcp_bogus"}
    )
    assert r3.status_code == 401

    client.delete(
        f"{settings.API_V1_STR}/api-keys/{key_id}", headers=superuser_token_headers
    )

    r4 = client.get(f"{settings.API_V1_STR}/users/me", headers={"X-API-Key": raw_key})
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


def test_create_api_key_response_defaults_role(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/api-keys/",
        headers=superuser_token_headers,
        json={"name": "default-role"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["role"] == "read_write"

    client.delete(
        f"{settings.API_V1_STR}/api-keys/{data['id']}",
        headers=superuser_token_headers,
    )


def test_read_only_key_allows_get(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/api-keys/",
        headers=superuser_token_headers,
        json={"name": "ro-get", "role": "read_only"},
    )
    raw_key = r.json()["key"]
    key_id = r.json()["id"]

    r2 = client.get(f"{settings.API_V1_STR}/items/", headers={"X-API-Key": raw_key})
    assert r2.status_code == 200

    client.delete(
        f"{settings.API_V1_STR}/api-keys/{key_id}", headers=superuser_token_headers
    )


def test_read_only_key_blocked_on_write(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/api-keys/",
        headers=superuser_token_headers,
        json={"name": "ro-write", "role": "read_only"},
    )
    raw_key = r.json()["key"]
    key_id = r.json()["id"]

    r2 = client.post(
        f"{settings.API_V1_STR}/items/",
        headers={"X-API-Key": raw_key},
        json={"title": "should not be allowed"},
    )
    assert r2.status_code == 403
    assert r2.json()["detail"] == "This API key is read-only"

    client.delete(
        f"{settings.API_V1_STR}/api-keys/{key_id}", headers=superuser_token_headers
    )


def test_read_write_key_allows_write(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/api-keys/",
        headers=superuser_token_headers,
        json={"name": "rw-write", "role": "read_write"},
    )
    raw_key = r.json()["key"]
    key_id = r.json()["id"]

    r2 = client.post(
        f"{settings.API_V1_STR}/items/",
        headers={"X-API-Key": raw_key},
        json={"title": "allowed"},
    )
    assert r2.status_code == 200

    client.delete(
        f"{settings.API_V1_STR}/api-keys/{key_id}", headers=superuser_token_headers
    )


def test_auto_provisioned_user_removed_on_revoke(
    client: TestClient, superuser_token_headers: dict[str, str], db
) -> None:
    from app.models import User

    r = client.post(
        f"{settings.API_V1_STR}/api-keys/",
        headers=superuser_token_headers,
        json={"name": "cleanup-test"},
    )
    key_id = r.json()["id"]

    r2 = client.get(f"{settings.API_V1_STR}/api-keys/", headers=superuser_token_headers)
    listed = r2.json()["data"]
    user_id = next(k["user_id"] for k in listed if k["id"] == key_id)

    service_user = db.get(User, user_id)
    assert service_user is not None
    assert service_user.is_service_account is True

    client.delete(
        f"{settings.API_V1_STR}/api-keys/{key_id}", headers=superuser_token_headers
    )

    db.expire_all()
    assert db.get(User, user_id) is None


def test_create_api_key_invalid_cidr_returns_422(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/api-keys/",
        headers=superuser_token_headers,
        json={"name": "bad-cidr", "allowed_ips": "not-a-cidr"},
    )
    assert r.status_code == 422


def test_restrictive_allowed_ips_blocks_request(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/api-keys/",
        headers=superuser_token_headers,
        json={"name": "restricted", "allowed_ips": "8.8.8.8/32"},
    )
    raw_key = r.json()["key"]
    key_id = r.json()["id"]

    r2 = client.get(f"{settings.API_V1_STR}/users/me", headers={"X-API-Key": raw_key})
    assert r2.status_code == 403
    assert r2.json()["detail"] == "API key not permitted from this IP address"

    client.delete(
        f"{settings.API_V1_STR}/api-keys/{key_id}", headers=superuser_token_headers
    )


def test_restrictive_allowed_ips_honors_x_forwarded_for(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/api-keys/",
        headers=superuser_token_headers,
        json={"name": "behind-proxy", "allowed_ips": "8.8.8.8/32"},
    )
    raw_key = r.json()["key"]
    key_id = r.json()["id"]

    r2 = client.get(
        f"{settings.API_V1_STR}/users/me",
        headers={"X-API-Key": raw_key, "X-Forwarded-For": "8.8.8.8"},
    )
    assert r2.status_code == 200

    r3 = client.get(
        f"{settings.API_V1_STR}/users/me",
        headers={"X-API-Key": raw_key, "X-Forwarded-For": "1.2.3.4"},
    )
    assert r3.status_code == 403

    client.delete(
        f"{settings.API_V1_STR}/api-keys/{key_id}", headers=superuser_token_headers
    )


def test_update_api_key_allowed_ips_takes_effect_immediately(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/api-keys/",
        headers=superuser_token_headers,
        json={"name": "editable"},
    )
    raw_key = r.json()["key"]
    key_id = r.json()["id"]

    r2 = client.get(f"{settings.API_V1_STR}/users/me", headers={"X-API-Key": raw_key})
    assert r2.status_code == 200

    r3 = client.patch(
        f"{settings.API_V1_STR}/api-keys/{key_id}",
        headers=superuser_token_headers,
        json={"allowed_ips": "8.8.8.8/32"},
    )
    assert r3.status_code == 200
    assert r3.json()["allowed_ips"] == "8.8.8.8/32"

    r4 = client.get(f"{settings.API_V1_STR}/users/me", headers={"X-API-Key": raw_key})
    assert r4.status_code == 403

    client.delete(
        f"{settings.API_V1_STR}/api-keys/{key_id}", headers=superuser_token_headers
    )


def test_update_api_key_explicit_null_rejected(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/api-keys/",
        headers=superuser_token_headers,
        json={"name": "null-guard"},
    )
    key_id = r.json()["id"]

    for field in ("name", "role", "is_active", "allowed_ips"):
        r2 = client.patch(
            f"{settings.API_V1_STR}/api-keys/{key_id}",
            headers=superuser_token_headers,
            json={field: None},
        )
        assert r2.status_code == 422, field

    client.delete(
        f"{settings.API_V1_STR}/api-keys/{key_id}", headers=superuser_token_headers
    )


def test_update_api_key_requires_superuser(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    normal_user_token_headers: dict[str, str],
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/api-keys/",
        headers=superuser_token_headers,
        json={"name": "protected"},
    )
    key_id = r.json()["id"]

    r2 = client.patch(
        f"{settings.API_V1_STR}/api-keys/{key_id}",
        headers=normal_user_token_headers,
        json={"name": "hacked"},
    )
    assert r2.status_code == 403

    client.delete(
        f"{settings.API_V1_STR}/api-keys/{key_id}", headers=superuser_token_headers
    )
