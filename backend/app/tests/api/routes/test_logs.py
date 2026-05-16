from fastapi.testclient import TestClient

from app.core.config import settings


def test_read_logs_superuser(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.get(f"{settings.API_V1_STR}/logs/", headers=superuser_token_headers)
    assert r.status_code == 200
    data = r.json()
    assert "data" in data
    assert "count" in data


def test_read_logs_normal_user_forbidden(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    r = client.get(f"{settings.API_V1_STR}/logs/", headers=normal_user_token_headers)
    assert r.status_code == 403


def test_read_logs_requires_auth(client: TestClient) -> None:
    r = client.get(f"{settings.API_V1_STR}/logs/")
    assert r.status_code == 401


def test_read_logs_with_filters(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.get(
        f"{settings.API_V1_STR}/logs/",
        headers=superuser_token_headers,
        params={"severity": "INFO", "limit": 10, "skip": 0},
    )
    assert r.status_code == 200
    data = r.json()
    for entry in data["data"]:
        assert entry["severity"] == "INFO"


def test_read_logs_pagination(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.get(
        f"{settings.API_V1_STR}/logs/",
        headers=superuser_token_headers,
        params={"limit": 1, "skip": 0},
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data["data"]) <= 1
