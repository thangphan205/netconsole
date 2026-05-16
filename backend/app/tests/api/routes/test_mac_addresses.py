import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.tests.utils.utils import random_lower_string


@pytest.fixture(scope="module")
def switch_id(client: TestClient, superuser_token_headers: dict[str, str]) -> int:
    hostname = f"mactestsw_{random_lower_string()[:6]}"
    r = client.post(
        f"{settings.API_V1_STR}/switches/",
        headers=superuser_token_headers,
        json={"hostname": hostname, "ipaddress": "10.2.0.1"},
    )
    sw_id: int = r.json()["id"]
    yield sw_id
    client.delete(
        f"{settings.API_V1_STR}/switches/{sw_id}",
        headers=superuser_token_headers,
    )


def test_read_mac_addresses(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.get(
        f"{settings.API_V1_STR}/mac_addresses/", headers=superuser_token_headers
    )
    assert r.status_code == 200
    data = r.json()
    assert "data" in data
    assert "count" in data


def test_create_mac_address(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    switch_id: int,
) -> None:
    payload = {"mac": "aabbccddeeff", "interface": "Gi0/1", "switch_id": switch_id}
    r = client.post(
        f"{settings.API_V1_STR}/mac_addresses/",
        headers=superuser_token_headers,
        json=payload,
    )
    assert r.status_code == 200
    mac = r.json()
    assert mac["mac"] == "aabbccddeeff"
    assert mac["switch_id"] == switch_id
    assert "id" in mac
    client.delete(
        f"{settings.API_V1_STR}/mac_addresses/{mac['id']}",
        headers=superuser_token_headers,
    )


def test_read_mac_address(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    switch_id: int,
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/mac_addresses/",
        headers=superuser_token_headers,
        json={"mac": "112233445566", "interface": "Gi0/2", "switch_id": switch_id},
    )
    mac_id = r.json()["id"]
    r2 = client.get(
        f"{settings.API_V1_STR}/mac_addresses/{mac_id}",
        headers=superuser_token_headers,
    )
    assert r2.status_code == 200
    assert r2.json()["id"] == mac_id
    client.delete(
        f"{settings.API_V1_STR}/mac_addresses/{mac_id}",
        headers=superuser_token_headers,
    )


def test_read_mac_address_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.get(
        f"{settings.API_V1_STR}/mac_addresses/999999",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404


def test_update_mac_address(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    switch_id: int,
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/mac_addresses/",
        headers=superuser_token_headers,
        json={"mac": "aabbccddee01", "interface": "Gi0/3", "switch_id": switch_id},
    )
    mac_id = r.json()["id"]
    r2 = client.put(
        f"{settings.API_V1_STR}/mac_addresses/{mac_id}",
        headers=superuser_token_headers,
        json={"vlan": 100},
    )
    assert r2.status_code == 200
    assert r2.json()["vlan"] == 100
    client.delete(
        f"{settings.API_V1_STR}/mac_addresses/{mac_id}",
        headers=superuser_token_headers,
    )


def test_delete_mac_address(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    switch_id: int,
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/mac_addresses/",
        headers=superuser_token_headers,
        json={"mac": "aabbccddee02", "interface": "Gi0/4", "switch_id": switch_id},
    )
    mac_id = r.json()["id"]
    r2 = client.delete(
        f"{settings.API_V1_STR}/mac_addresses/{mac_id}",
        headers=superuser_token_headers,
    )
    assert r2.status_code == 200
    r3 = client.get(
        f"{settings.API_V1_STR}/mac_addresses/{mac_id}",
        headers=superuser_token_headers,
    )
    assert r3.status_code == 404


def test_mac_addresses_requires_auth(client: TestClient) -> None:
    r = client.get(f"{settings.API_V1_STR}/mac_addresses/")
    assert r.status_code == 401
