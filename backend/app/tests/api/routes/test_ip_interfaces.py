import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.tests.utils.utils import random_lower_string


@pytest.fixture(scope="module")
def switch_id(client: TestClient, superuser_token_headers: dict[str, str]) -> int:
    hostname = f"iptestsw_{random_lower_string()[:6]}"
    r = client.post(
        f"{settings.API_V1_STR}/switches/",
        headers=superuser_token_headers,
        json={"hostname": hostname, "ipaddress": "10.3.0.1"},
    )
    sw_id: int = r.json()["id"]
    yield sw_id
    client.delete(
        f"{settings.API_V1_STR}/switches/{sw_id}",
        headers=superuser_token_headers,
    )


def test_read_ip_interfaces(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.get(
        f"{settings.API_V1_STR}/ip_interfaces/", headers=superuser_token_headers
    )
    assert r.status_code == 200
    data = r.json()
    assert "data" in data
    assert "count" in data


def test_create_ip_interface(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    switch_id: int,
) -> None:
    payload = {
        "interface": "Loopback0",
        "ipv4": "10.255.0.1/32",
        "switch_id": switch_id,
    }
    r = client.post(
        f"{settings.API_V1_STR}/ip_interfaces/",
        headers=superuser_token_headers,
        json=payload,
    )
    assert r.status_code == 200
    iface = r.json()
    assert iface["interface"] == "Loopback0"
    assert iface["switch_id"] == switch_id
    assert "id" in iface
    client.delete(
        f"{settings.API_V1_STR}/ip_interfaces/{iface['id']}",
        headers=superuser_token_headers,
    )


def test_read_ip_interface(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    switch_id: int,
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/ip_interfaces/",
        headers=superuser_token_headers,
        json={
            "interface": "Loopback1",
            "ipv4": "10.255.0.2/32",
            "switch_id": switch_id,
        },
    )
    iface_id = r.json()["id"]
    r2 = client.get(
        f"{settings.API_V1_STR}/ip_interfaces/{iface_id}",
        headers=superuser_token_headers,
    )
    assert r2.status_code == 200
    assert r2.json()["id"] == iface_id
    client.delete(
        f"{settings.API_V1_STR}/ip_interfaces/{iface_id}",
        headers=superuser_token_headers,
    )


def test_read_ip_interface_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.get(
        f"{settings.API_V1_STR}/ip_interfaces/999999",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404


def test_update_ip_interface(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    switch_id: int,
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/ip_interfaces/",
        headers=superuser_token_headers,
        json={
            "interface": "Loopback2",
            "ipv4": "10.255.0.3/32",
            "switch_id": switch_id,
        },
    )
    iface_id = r.json()["id"]
    r2 = client.put(
        f"{settings.API_V1_STR}/ip_interfaces/{iface_id}",
        headers=superuser_token_headers,
        json={"ipv6": "::1/128"},
    )
    assert r2.status_code == 200
    assert r2.json()["ipv6"] == "::1/128"
    client.delete(
        f"{settings.API_V1_STR}/ip_interfaces/{iface_id}",
        headers=superuser_token_headers,
    )


def test_delete_ip_interface(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    switch_id: int,
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/ip_interfaces/",
        headers=superuser_token_headers,
        json={
            "interface": "Loopback3",
            "ipv4": "10.255.0.4/32",
            "switch_id": switch_id,
        },
    )
    iface_id = r.json()["id"]
    r2 = client.delete(
        f"{settings.API_V1_STR}/ip_interfaces/{iface_id}",
        headers=superuser_token_headers,
    )
    assert r2.status_code == 200
    r3 = client.get(
        f"{settings.API_V1_STR}/ip_interfaces/{iface_id}",
        headers=superuser_token_headers,
    )
    assert r3.status_code == 404


def test_ip_interfaces_requires_auth(client: TestClient) -> None:
    r = client.get(f"{settings.API_V1_STR}/ip_interfaces/")
    assert r.status_code == 401
