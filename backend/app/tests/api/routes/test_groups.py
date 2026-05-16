from fastapi.testclient import TestClient

from app.core.config import settings
from app.tests.utils.utils import random_lower_string


def _group_payload(suffix: str = "") -> dict[str, str]:
    tag = random_lower_string()[:8] + suffix
    return {"name": f"grp_{tag}", "description": "test group", "site": f"site_{tag}"}


def test_read_groups(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.get(f"{settings.API_V1_STR}/groups/", headers=superuser_token_headers)
    assert r.status_code == 200
    data = r.json()
    assert "data" in data
    assert "count" in data


def test_create_group(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    payload = _group_payload()
    r = client.post(
        f"{settings.API_V1_STR}/groups/",
        headers=superuser_token_headers,
        json=payload,
    )
    assert r.status_code == 200
    g = r.json()
    assert g["name"] == payload["name"]
    assert "id" in g
    client.delete(
        f"{settings.API_V1_STR}/groups/{g['id']}",
        headers=superuser_token_headers,
    )


def test_create_group_duplicate_name(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    payload = _group_payload("dup")
    r1 = client.post(
        f"{settings.API_V1_STR}/groups/",
        headers=superuser_token_headers,
        json=payload,
    )
    assert r1.status_code == 200
    g_id = r1.json()["id"]
    r2 = client.post(
        f"{settings.API_V1_STR}/groups/",
        headers=superuser_token_headers,
        json=payload,
    )
    assert r2.status_code == 400
    client.delete(
        f"{settings.API_V1_STR}/groups/{g_id}",
        headers=superuser_token_headers,
    )


def test_read_group(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    payload = _group_payload("get")
    r = client.post(
        f"{settings.API_V1_STR}/groups/",
        headers=superuser_token_headers,
        json=payload,
    )
    g_id = r.json()["id"]
    r2 = client.get(
        f"{settings.API_V1_STR}/groups/{g_id}",
        headers=superuser_token_headers,
    )
    assert r2.status_code == 200
    assert r2.json()["id"] == g_id
    client.delete(
        f"{settings.API_V1_STR}/groups/{g_id}",
        headers=superuser_token_headers,
    )


def test_read_group_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.get(
        f"{settings.API_V1_STR}/groups/999999",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404


def test_update_group(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    payload = _group_payload("upd")
    r = client.post(
        f"{settings.API_V1_STR}/groups/",
        headers=superuser_token_headers,
        json=payload,
    )
    g_id = r.json()["id"]
    r2 = client.put(
        f"{settings.API_V1_STR}/groups/{g_id}",
        headers=superuser_token_headers,
        json={"description": "updated description"},
    )
    assert r2.status_code == 200
    assert r2.json()["description"] == "updated description"
    client.delete(
        f"{settings.API_V1_STR}/groups/{g_id}",
        headers=superuser_token_headers,
    )


def test_delete_group(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    payload = _group_payload("del")
    r = client.post(
        f"{settings.API_V1_STR}/groups/",
        headers=superuser_token_headers,
        json=payload,
    )
    g_id = r.json()["id"]
    r2 = client.delete(
        f"{settings.API_V1_STR}/groups/{g_id}",
        headers=superuser_token_headers,
    )
    assert r2.status_code == 200
    r3 = client.get(
        f"{settings.API_V1_STR}/groups/{g_id}",
        headers=superuser_token_headers,
    )
    assert r3.status_code == 404


def test_groups_requires_auth(client: TestClient) -> None:
    r = client.get(f"{settings.API_V1_STR}/groups/")
    assert r.status_code == 401
