import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.tests.utils.utils import random_lower_string


@pytest.fixture(scope="module")
def switch_id(client: TestClient, superuser_token_headers: dict[str, str]) -> int:
    hostname = f"arptestsw_{random_lower_string()[:6]}"
    r = client.post(
        f"{settings.API_V1_STR}/switches/",
        headers=superuser_token_headers,
        json={"hostname": hostname, "ipaddress": "10.1.0.1"},
    )
    sw_id: int = r.json()["id"]
    yield sw_id
    client.delete(
        f"{settings.API_V1_STR}/switches/{sw_id}",
        headers=superuser_token_headers,
    )


def test_read_arps(client: TestClient, superuser_token_headers: dict[str, str]) -> None:
    r = client.get(f"{settings.API_V1_STR}/arps/", headers=superuser_token_headers)
    assert r.status_code == 200
    data = r.json()
    assert "data" in data
    assert "count" in data


def test_create_arp(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    switch_id: int,
) -> None:
    payload = {"ip": "192.168.1.1", "interface": "Gi0/1", "switch_id": switch_id}
    r = client.post(
        f"{settings.API_V1_STR}/arps/",
        headers=superuser_token_headers,
        json=payload,
    )
    assert r.status_code == 200
    arp = r.json()
    assert arp["ip"] == "192.168.1.1"
    assert arp["switch_id"] == switch_id
    assert "id" in arp
    client.delete(
        f"{settings.API_V1_STR}/arps/{arp['id']}",
        headers=superuser_token_headers,
    )


def test_read_arp(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    switch_id: int,
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/arps/",
        headers=superuser_token_headers,
        json={"ip": "192.168.1.2", "interface": "Gi0/2", "switch_id": switch_id},
    )
    arp_id = r.json()["id"]
    r2 = client.get(
        f"{settings.API_V1_STR}/arps/{arp_id}",
        headers=superuser_token_headers,
    )
    assert r2.status_code == 200
    assert r2.json()["id"] == arp_id
    client.delete(
        f"{settings.API_V1_STR}/arps/{arp_id}",
        headers=superuser_token_headers,
    )


def test_read_arp_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.get(
        f"{settings.API_V1_STR}/arps/999999",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404


def test_update_arp(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    switch_id: int,
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/arps/",
        headers=superuser_token_headers,
        json={"ip": "192.168.1.3", "interface": "Gi0/3", "switch_id": switch_id},
    )
    arp_id = r.json()["id"]
    r2 = client.put(
        f"{settings.API_V1_STR}/arps/{arp_id}",
        headers=superuser_token_headers,
        json={"mac": "aa:bb:cc:dd:ee:ff"},
    )
    assert r2.status_code == 200
    assert r2.json()["mac"] == "aa:bb:cc:dd:ee:ff"
    client.delete(
        f"{settings.API_V1_STR}/arps/{arp_id}",
        headers=superuser_token_headers,
    )


def test_delete_arp(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    switch_id: int,
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/arps/",
        headers=superuser_token_headers,
        json={"ip": "192.168.1.4", "interface": "Gi0/4", "switch_id": switch_id},
    )
    arp_id = r.json()["id"]
    r2 = client.delete(
        f"{settings.API_V1_STR}/arps/{arp_id}",
        headers=superuser_token_headers,
    )
    assert r2.status_code == 200
    r3 = client.get(
        f"{settings.API_V1_STR}/arps/{arp_id}",
        headers=superuser_token_headers,
    )
    assert r3.status_code == 404


def test_arps_filter_by_switch(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    switch_id: int,
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/arps/",
        headers=superuser_token_headers,
        json={"ip": "192.168.1.5", "interface": "Gi0/5", "switch_id": switch_id},
    )
    arp_id = r.json()["id"]
    r2 = client.get(
        f"{settings.API_V1_STR}/arps/",
        headers=superuser_token_headers,
        params={"switch_id": switch_id},
    )
    assert r2.status_code == 200
    ids = [a["id"] for a in r2.json()["data"]]
    assert arp_id in ids
    client.delete(
        f"{settings.API_V1_STR}/arps/{arp_id}",
        headers=superuser_token_headers,
    )


def test_arps_requires_auth(client: TestClient) -> None:
    r = client.get(f"{settings.API_V1_STR}/arps/")
    assert r.status_code == 401
