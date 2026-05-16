from fastapi.testclient import TestClient

from app.core.config import settings
from app.tests.utils.utils import random_lower_string


def test_read_switches(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.get(f"{settings.API_V1_STR}/switches/", headers=superuser_token_headers)
    assert r.status_code == 200
    data = r.json()
    assert "data" in data
    assert "count" in data


def test_create_switch(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    hostname = f"testswitch_{random_lower_string()[:8]}"
    payload = {"hostname": hostname, "ipaddress": "10.0.0.1"}
    r = client.post(
        f"{settings.API_V1_STR}/switches/",
        headers=superuser_token_headers,
        json=payload,
    )
    assert r.status_code == 200
    sw = r.json()
    assert sw["hostname"] == hostname
    assert sw["ipaddress"] == "10.0.0.1"
    assert "id" in sw
    # cleanup
    client.delete(
        f"{settings.API_V1_STR}/switches/{sw['id']}",
        headers=superuser_token_headers,
    )


def test_create_switch_duplicate_hostname(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    hostname = f"dupswitch_{random_lower_string()[:8]}"
    payload = {"hostname": hostname, "ipaddress": "10.0.0.2"}
    r1 = client.post(
        f"{settings.API_V1_STR}/switches/",
        headers=superuser_token_headers,
        json=payload,
    )
    assert r1.status_code == 200
    sw_id = r1.json()["id"]
    r2 = client.post(
        f"{settings.API_V1_STR}/switches/",
        headers=superuser_token_headers,
        json=payload,
    )
    assert r2.status_code == 400
    # cleanup
    client.delete(
        f"{settings.API_V1_STR}/switches/{sw_id}",
        headers=superuser_token_headers,
    )


def test_read_switch(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    hostname = f"getsw_{random_lower_string()[:8]}"
    r = client.post(
        f"{settings.API_V1_STR}/switches/",
        headers=superuser_token_headers,
        json={"hostname": hostname, "ipaddress": "10.0.0.3"},
    )
    sw_id = r.json()["id"]
    r2 = client.get(
        f"{settings.API_V1_STR}/switches/{sw_id}",
        headers=superuser_token_headers,
    )
    assert r2.status_code == 200
    assert r2.json()["id"] == sw_id
    client.delete(
        f"{settings.API_V1_STR}/switches/{sw_id}",
        headers=superuser_token_headers,
    )


def test_read_switch_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.get(
        f"{settings.API_V1_STR}/switches/999999",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404


def test_update_switch(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    hostname = f"updsw_{random_lower_string()[:8]}"
    r = client.post(
        f"{settings.API_V1_STR}/switches/",
        headers=superuser_token_headers,
        json={"hostname": hostname, "ipaddress": "10.0.0.4"},
    )
    sw_id = r.json()["id"]
    r2 = client.put(
        f"{settings.API_V1_STR}/switches/{sw_id}",
        headers=superuser_token_headers,
        json={"ipaddress": "10.0.0.99"},
    )
    assert r2.status_code == 200
    assert r2.json()["ipaddress"] == "10.0.0.99"
    client.delete(
        f"{settings.API_V1_STR}/switches/{sw_id}",
        headers=superuser_token_headers,
    )


def test_delete_switch(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    hostname = f"delsw_{random_lower_string()[:8]}"
    r = client.post(
        f"{settings.API_V1_STR}/switches/",
        headers=superuser_token_headers,
        json={"hostname": hostname, "ipaddress": "10.0.0.5"},
    )
    sw_id = r.json()["id"]
    r2 = client.delete(
        f"{settings.API_V1_STR}/switches/{sw_id}",
        headers=superuser_token_headers,
    )
    assert r2.status_code == 200
    r3 = client.get(
        f"{settings.API_V1_STR}/switches/{sw_id}",
        headers=superuser_token_headers,
    )
    assert r3.status_code == 404


def test_switch_requires_auth(client: TestClient) -> None:
    r = client.get(f"{settings.API_V1_STR}/switches/")
    assert r.status_code == 401
