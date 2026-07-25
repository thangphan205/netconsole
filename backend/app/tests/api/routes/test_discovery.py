import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.automation import discovery as disc
from app.core.config import settings
from app.models import Credential, Device
from app.tests.utils.utils import random_lower_string


# ---------------------------------------------------------------- unit tests
def test_expand_cidr_basic():
    hosts = disc.expand_cidr("10.0.0.0/29")
    assert len(hosts) == 6
    assert "10.0.0.1" in hosts


def test_expand_cidr_non_strict():
    hosts = disc.expand_cidr("10.0.0.5/24")
    assert len(hosts) == 254


def test_expand_cidr_rejects_garbage():
    with pytest.raises(ValueError):
        disc.expand_cidr("not-a-cidr")


def test_expand_cidr_rejects_too_large():
    with pytest.raises(ValueError):
        disc.expand_cidr("10.0.0.0/16")


def test_expand_cidr_rejects_ipv6():
    with pytest.raises(ValueError):
        disc.expand_cidr("2001:db8::/64")


def test_sanitize_hostname():
    assert disc.sanitize_hostname("core-sw-01.corp.net") == "core_sw_01"
    assert disc.sanitize_hostname("plain") == "plain"


def test_platform_map_coverage():
    for dt in ("cisco_ios", "cisco_xe", "cisco_nxos", "juniper_junos", "arista_eos"):
        assert dt in disc.PLATFORM_MAP
    assert disc.PLATFORM_MAP["cisco_xe"] == ("ios", "cisco_ios")


# ---------------------------------------------------------------- fixtures
@pytest.fixture
def credential(db: Session):
    from app.core.crypto import encrypt_password

    cred = Credential(
        username=f"disc_{random_lower_string()[:6]}",
        password=encrypt_password("secret"),
    )
    db.add(cred)
    db.commit()
    db.refresh(cred)
    yield cred
    db.delete(cred)
    db.commit()


# ---------------------------------------------------------------- scan
def test_scan_marks_existing(
    client: TestClient, superuser_token_headers, db: Session, monkeypatch
):
    sw = Device(hostname=f"exist_{random_lower_string()[:6]}", ipaddress="10.9.9.5")
    db.add(sw)
    db.commit()
    db.refresh(sw)
    monkeypatch.setattr(
        "app.api.routes.discovery.scan_subnet",
        lambda ips, port, timeout: ["10.9.9.5", "10.9.9.6"],
    )
    r = client.post(
        f"{settings.API_V1_STR}/devices/discovery/scan",
        headers=superuser_token_headers,
        json={"cidr": "10.9.9.0/29"},
    )
    assert r.status_code == 200
    hosts = {h["ip"]: h for h in r.json()["hosts"]}
    assert hosts["10.9.9.5"]["existing"] is True
    assert hosts["10.9.9.5"]["existing_hostname"] == sw.hostname
    assert hosts["10.9.9.6"]["existing"] is False
    db.delete(sw)
    db.commit()


def test_scan_bad_cidr(client: TestClient, superuser_token_headers):
    r = client.post(
        f"{settings.API_V1_STR}/devices/discovery/scan",
        headers=superuser_token_headers,
        json={"cidr": "bogus"},
    )
    assert r.status_code == 400


def test_scan_forbidden_for_normal_user(client: TestClient, normal_user_token_headers):
    r = client.post(
        f"{settings.API_V1_STR}/devices/discovery/scan",
        headers=normal_user_token_headers,
        json={"cidr": "10.0.0.0/29"},
    )
    assert r.status_code == 403


# ---------------------------------------------------------------- identify
def test_identify_happy(
    client: TestClient, superuser_token_headers, credential: Credential, monkeypatch
):
    monkeypatch.setattr(
        "app.api.routes.discovery.identify_hosts_parallel",
        lambda ips, port, creds: [
            {
                "ip": ips[0],
                "port": port,
                "status": "identified",
                "platform": "ios",
                "device_type": "cisco_ios",
                "hostname": "sw1",
                "raw_hostname": "sw1.corp",
                "vendor": "Cisco",
                "model": "C9300",
                "os_version": "17.3",
                "serial_number": "ABC123",
                "credential_id": creds[0]["id"],
                "error": None,
            }
        ],
    )
    r = client.post(
        f"{settings.API_V1_STR}/devices/discovery/identify",
        headers=superuser_token_headers,
        json={"ips": ["10.0.0.10"], "credential_ids": [credential.id]},
    )
    assert r.status_code == 200
    cands = r.json()["candidates"]
    assert cands[0]["hostname"] == "sw1"
    assert cands[0]["platform"] == "ios"


def test_identify_too_many_ips(
    client: TestClient, superuser_token_headers, credential: Credential
):
    r = client.post(
        f"{settings.API_V1_STR}/devices/discovery/identify",
        headers=superuser_token_headers,
        json={
            "ips": [f"10.0.0.{i}" for i in range(9)],
            "credential_ids": [credential.id],
        },
    )
    assert r.status_code == 422


def test_identify_empty_credentials(client: TestClient, superuser_token_headers):
    r = client.post(
        f"{settings.API_V1_STR}/devices/discovery/identify",
        headers=superuser_token_headers,
        json={"ips": ["10.0.0.10"], "credential_ids": []},
    )
    assert r.status_code == 422


def test_identify_unknown_credential(client: TestClient, superuser_token_headers):
    r = client.post(
        f"{settings.API_V1_STR}/devices/discovery/identify",
        headers=superuser_token_headers,
        json={"ips": ["10.0.0.10"], "credential_ids": [999999]},
    )
    assert r.status_code == 404


def test_identify_forbidden_for_normal_user(
    client: TestClient, normal_user_token_headers
):
    r = client.post(
        f"{settings.API_V1_STR}/devices/discovery/identify",
        headers=normal_user_token_headers,
        json={"ips": ["10.0.0.10"], "credential_ids": [1]},
    )
    assert r.status_code == 403


# ---------------------------------------------------------------- add
def test_add_partial(client: TestClient, superuser_token_headers, monkeypatch):
    monkeypatch.setattr("app.crud.devices.create_hosts", lambda devices_db: None)
    h1 = f"disc_{random_lower_string()[:6]}"
    payload = {
        "devices": [
            {"hostname": h1, "ipaddress": "10.8.8.1", "platform": "ios"},
            {"hostname": h1, "ipaddress": "10.8.8.2", "platform": "ios"},  # dup name
            {"hostname": "bad-name", "ipaddress": "10.8.8.3"},  # bad charset
        ]
    }
    r = client.post(
        f"{settings.API_V1_STR}/devices/discovery/add",
        headers=superuser_token_headers,
        json=payload,
    )
    assert r.status_code == 200
    body = r.json()
    assert len(body["created"]) == 1
    assert len(body["errors"]) == 2
    for s in body["created"]:
        client.delete(
            f"{settings.API_V1_STR}/devices/{s['id']}", headers=superuser_token_headers
        )


def test_add_forbidden_for_normal_user(client: TestClient, normal_user_token_headers):
    r = client.post(
        f"{settings.API_V1_STR}/devices/discovery/add",
        headers=normal_user_token_headers,
        json={"devices": [{"hostname": "x", "ipaddress": "10.0.0.1"}]},
    )
    assert r.status_code == 403
