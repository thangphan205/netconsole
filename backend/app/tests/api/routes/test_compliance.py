import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.automation.compliance_rules import RULES
from app.core.config import settings
from app.models import Device, Group
from app.tests.utils.utils import random_lower_string

IOS_HARDENED = """
service timestamps log datetime msec localtime show-timezone
service password-encryption
ntp server 10.0.0.1
logging host 10.0.0.2
ip name-server 10.0.0.3
ip ssh version 2
no ip http server
security passwords min-length 12
login block-for 120 attempts 5 within 60
banner motd ^C Unauthorized access is prohibited. ^C
aaa new-model
line vty 0 15
 exec-timeout 10 0
 transport input ssh
line con 0
 exec-timeout 10 0
"""

BARE_CONFIG = "hostname r1\n"

BASE = f"{settings.API_V1_STR}/compliance"


def _make_device(db: Session, *, platform: str = "ios", groups: str = "") -> Device:
    device = Device(
        hostname=f"cmpl_{random_lower_string()[:8]}",
        ipaddress="10.9.0.1",
        platform=platform,
        groups=groups,
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return device


def _put_global_profile(
    client: TestClient, headers: dict[str, str], profile: dict
) -> None:
    client.put(
        f"{BASE}/profiles/global",
        headers=headers,
        json={
            key: profile.get(key)
            for key in (
                "ntp_server",
                "syslog_server",
                "dns_server",
                "password_min_length",
                "exec_timeout_minutes",
            )
        },
    )


@pytest.fixture(autouse=True)
def pinned_global_profile(client: TestClient, superuser_token_headers: dict[str, str]):
    """Pin the global profile to the servers IOS_HARDENED actually configures.

    The whole file's pass/fail expectations are written against those values,
    so a database carrying real operational values (this app ships a single
    global profile row, shared with the running app) would otherwise fail the
    suite for reasons that have nothing to do with the code under test.
    """
    original = client.get(f"{BASE}/profiles", headers=superuser_token_headers).json()[
        "global_profile"
    ]
    _put_global_profile(
        client,
        superuser_token_headers,
        {
            "ntp_server": "10.0.0.1",
            "syslog_server": "10.0.0.2",
            "dns_server": "10.0.0.3",
            "password_min_length": 12,
            "exec_timeout_minutes": 10,
        },
    )
    yield
    _put_global_profile(client, superuser_token_headers, original)


def _delete_device_via_api(
    client: TestClient, headers: dict[str, str], device_id: int | None
) -> None:
    # Goes through the route so cascade cleanup (incl. compliance runs) runs,
    # unlike a raw db.delete() which would hit an FK violation.
    client.delete(f"{settings.API_V1_STR}/devices/{device_id}", headers=headers)


def test_read_rules(client: TestClient, superuser_token_headers: dict[str, str]):
    r = client.get(f"{BASE}/rules", headers=superuser_token_headers)
    assert r.status_code == 200
    data = r.json()["data"]
    assert len(data) == len(RULES)
    ntp = next(rule for rule in data if rule["id"] == "NTP-01")
    assert "10.6.1" in ntp["pci_dss"]
    assert "A.8.17" in ntp["iso27001"]


def test_rules_requires_auth(client: TestClient):
    r = client.get(f"{BASE}/rules")
    assert r.status_code == 401


def test_read_profiles_seeds_global_defaults(
    client: TestClient, superuser_token_headers: dict[str, str]
):
    r = client.get(f"{BASE}/profiles", headers=superuser_token_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["global_profile"]["group_id"] is None
    assert isinstance(data["group_profiles"], list)


def test_update_global_profile(
    client: TestClient, superuser_token_headers: dict[str, str]
):
    original = client.get(f"{BASE}/profiles", headers=superuser_token_headers).json()[
        "global_profile"
    ]
    try:
        r = client.put(
            f"{BASE}/profiles/global",
            headers=superuser_token_headers,
            json={"ntp_server": "10.1.1.1", "password_min_length": 14},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["ntp_server"] == "10.1.1.1"
        assert body["password_min_length"] == 14
    finally:
        # Other tests assume default global profile values — restore them so
        # this test doesn't leak state into the rest of the suite.
        client.put(
            f"{BASE}/profiles/global",
            headers=superuser_token_headers,
            json={
                "ntp_server": original["ntp_server"],
                "syslog_server": original["syslog_server"],
                "dns_server": original["dns_server"],
                "password_min_length": original["password_min_length"],
                "exec_timeout_minutes": original["exec_timeout_minutes"],
            },
        )


def test_group_profile_upsert_and_delete(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
):
    group = Group(
        name=f"cmplgrp_{random_lower_string()[:8]}", description="", site="site1"
    )
    db.add(group)
    db.commit()
    db.refresh(group)

    r = client.put(
        f"{BASE}/profiles/group/{group.id}",
        headers=superuser_token_headers,
        json={"syslog_server": "10.2.2.2"},
    )
    assert r.status_code == 200
    assert r.json()["syslog_server"] == "10.2.2.2"
    assert r.json()["group_id"] == group.id

    r2 = client.delete(
        f"{BASE}/profiles/group/{group.id}", headers=superuser_token_headers
    )
    assert r2.status_code == 200

    r3 = client.delete(
        f"{BASE}/profiles/group/{group.id}", headers=superuser_token_headers
    )
    assert r3.status_code == 404

    db.delete(group)
    db.commit()


def test_group_profile_not_found_group(
    client: TestClient, superuser_token_headers: dict[str, str]
):
    r = client.put(
        f"{BASE}/profiles/group/999999",
        headers=superuser_token_headers,
        json={"syslog_server": "10.2.2.2"},
    )
    assert r.status_code == 404


def test_run_check_requires_superuser(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
):
    device = _make_device(db)
    r = client.post(
        f"{BASE}/devices/{device.id}/run", headers=normal_user_token_headers
    )
    assert r.status_code == 403
    db.delete(device)
    db.commit()


def test_run_check_unsupported_platform(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
):
    device = _make_device(db, platform="iosxr")
    r = client.post(f"{BASE}/devices/{device.id}/run", headers=superuser_token_headers)
    assert r.status_code == 400
    db.delete(device)
    db.commit()


def test_run_check_device_auth_error(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    monkeypatch,
):
    from app.automation.devices import DeviceAuthenticationError

    device = _make_device(db)

    def raise_auth_error(_device):
        raise DeviceAuthenticationError("bad creds")

    monkeypatch.setattr(
        "app.api.routes.compliance.get_compliance_config", raise_auth_error
    )
    r = client.post(f"{BASE}/devices/{device.id}/run", headers=superuser_token_headers)
    assert r.status_code == 400
    assert "Authentication failed" in r.json()["detail"]
    db.delete(device)
    db.commit()


def test_run_check_success_and_latest_and_by_id(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    monkeypatch,
):
    device = _make_device(db)
    monkeypatch.setattr(
        "app.api.routes.compliance.get_compliance_config", lambda _device: IOS_HARDENED
    )

    r = client.post(f"{BASE}/devices/{device.id}/run", headers=superuser_token_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["run"]["device_id"] == device.id
    assert body["run"]["failed_count"] == 0
    assert len(body["results"]) == len(RULES)

    r2 = client.get(
        f"{BASE}/devices/{device.id}/latest", headers=superuser_token_headers
    )
    assert r2.status_code == 200
    assert r2.json()["run"]["id"] == body["run"]["id"]

    run_id = body["run"]["id"]
    r3 = client.get(f"{BASE}/runs/{run_id}", headers=superuser_token_headers)
    assert r3.status_code == 200
    assert r3.json()["run"]["id"] == run_id

    _delete_device_via_api(client, superuser_token_headers, device.id)


def test_latest_run_404_when_none(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
):
    device = _make_device(db)
    r = client.get(
        f"{BASE}/devices/{device.id}/latest", headers=superuser_token_headers
    )
    assert r.status_code == 404
    db.delete(device)
    db.commit()


def test_summary_endpoint(client: TestClient, superuser_token_headers: dict[str, str]):
    r = client.get(f"{BASE}/summary", headers=superuser_token_headers)
    assert r.status_code == 200
    assert "data" in r.json()


def test_group_run(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    monkeypatch,
):
    group_name = f"cmplrun_{random_lower_string()[:8]}"
    device = _make_device(db, groups=group_name)
    monkeypatch.setattr(
        "app.api.routes.compliance.get_compliance_config", lambda _device: IOS_HARDENED
    )
    r = client.post(f"{BASE}/groups/{group_name}/run", headers=superuser_token_headers)
    assert r.status_code == 200
    body = r.json()
    assert device.hostname in body["run_ids"]
    assert body["errors"] == []
    _delete_device_via_api(client, superuser_token_headers, device.id)


def test_remediation_preview_and_confirm_flow(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    monkeypatch,
):
    device = _make_device(db)
    monkeypatch.setattr(
        "app.api.routes.compliance.get_compliance_config", lambda _device: BARE_CONFIG
    )
    run_resp = client.post(
        f"{BASE}/devices/{device.id}/run", headers=superuser_token_headers
    )
    run_id = run_resp.json()["run"]["id"]

    preview = client.post(
        f"{BASE}/devices/{device.id}/remediation-preview",
        headers=superuser_token_headers,
        json={"run_id": run_id, "rule_ids": ["AAA-01"]},
    )
    assert preview.status_code == 200
    preview_body = preview.json()
    assert preview_body["commands"] == "aaa new-model"
    sha = preview_body["commands_sha256"]

    # confirm=false is rejected
    r_noconfirm = client.post(
        f"{BASE}/devices/{device.id}/remediate",
        headers=superuser_token_headers,
        json={"run_id": run_id, "rule_ids": ["AAA-01"], "confirm": False},
    )
    assert r_noconfirm.status_code == 400

    # stale sha is rejected
    r_stale = client.post(
        f"{BASE}/devices/{device.id}/remediate",
        headers=superuser_token_headers,
        json={
            "run_id": run_id,
            "rule_ids": ["AAA-01"],
            "confirm": True,
            "expected_commands_sha256": "deadbeef",
        },
    )
    assert r_stale.status_code == 409

    monkeypatch.setattr(
        "app.api.routes.compliance.snapshot_device_config",
        lambda *args, **kwargs: None,
    )
    monkeypatch.setattr(
        "app.api.routes.compliance.device_configure",
        lambda hostname, commands, command_type: {hostname: "OK"},
    )
    monkeypatch.setattr(
        "app.api.routes.compliance.get_compliance_config", lambda _device: IOS_HARDENED
    )

    r_ok = client.post(
        f"{BASE}/devices/{device.id}/remediate",
        headers=superuser_token_headers,
        json={
            "run_id": run_id,
            "rule_ids": ["AAA-01"],
            "confirm": True,
            "expected_commands_sha256": sha,
        },
    )
    assert r_ok.status_code == 200
    assert r_ok.json()["status"] is True
    assert r_ok.json()["new_run_id"] is not None

    _delete_device_via_api(client, superuser_token_headers, device.id)


def test_remediation_preview_rejects_non_failing_rule(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    monkeypatch,
):
    device = _make_device(db)
    monkeypatch.setattr(
        "app.api.routes.compliance.get_compliance_config", lambda _device: IOS_HARDENED
    )
    run_resp = client.post(
        f"{BASE}/devices/{device.id}/run", headers=superuser_token_headers
    )
    run_id = run_resp.json()["run"]["id"]

    r = client.post(
        f"{BASE}/devices/{device.id}/remediation-preview",
        headers=superuser_token_headers,
        json={"run_id": run_id, "rule_ids": ["NTP-01"]},
    )
    assert r.status_code == 400

    _delete_device_via_api(client, superuser_token_headers, device.id)


def test_remediate_push_failure_surfaces_error(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    monkeypatch,
):
    device = _make_device(db)
    monkeypatch.setattr(
        "app.api.routes.compliance.get_compliance_config", lambda _device: BARE_CONFIG
    )
    run_resp = client.post(
        f"{BASE}/devices/{device.id}/run", headers=superuser_token_headers
    )
    run_id = run_resp.json()["run"]["id"]

    monkeypatch.setattr(
        "app.api.routes.compliance.snapshot_device_config",
        lambda *args, **kwargs: None,
    )
    monkeypatch.setattr(
        "app.api.routes.compliance.device_configure",
        lambda hostname, commands, command_type: {
            hostname: "ERROR: connection refused"
        },
    )

    r = client.post(
        f"{BASE}/devices/{device.id}/remediate",
        headers=superuser_token_headers,
        json={"run_id": run_id, "rule_ids": ["AAA-01"], "confirm": True},
    )
    assert r.status_code == 400
    assert "Push failed" in r.json()["detail"]

    _delete_device_via_api(client, superuser_token_headers, device.id)


def _run_group(client: TestClient, headers: dict[str, str], group_name: str) -> None:
    r = client.post(f"{BASE}/groups/{group_name}/run", headers=headers)
    assert r.status_code == 200


def test_group_remediation_preview_lists_per_device_commands(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    monkeypatch,
):
    group_name = f"cmplrem_{random_lower_string()[:8]}"
    device_a = _make_device(db, groups=group_name)
    device_b = _make_device(db, groups=group_name)
    monkeypatch.setattr(
        "app.api.routes.compliance.get_compliance_config", lambda _device: BARE_CONFIG
    )
    _run_group(client, superuser_token_headers, group_name)

    r = client.post(
        f"{BASE}/groups/{group_name}/remediation-preview",
        headers=superuser_token_headers,
        json={"rule_ids": []},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["group_name"] == group_name
    assert body["total_devices"] == 2
    assert len(body["devices"]) == 2
    assert all(s["status"] == "ready" for s in body["devices"])
    assert all("aaa new-model" in s["commands"] for s in body["devices"])
    assert body["commands_sha256"]
    # hostname-sorted, so the plan is stable regardless of DB row order
    assert [s["hostname"] for s in body["devices"]] == sorted(
        [device_a.hostname, device_b.hostname]
    )

    _delete_device_via_api(client, superuser_token_headers, device_a.id)
    _delete_device_via_api(client, superuser_token_headers, device_b.id)


def test_group_preview_is_deterministic_and_ignores_non_ready_devices(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    monkeypatch,
):
    group_name = f"cmpldet_{random_lower_string()[:8]}"
    device = _make_device(db, groups=group_name)
    monkeypatch.setattr(
        "app.api.routes.compliance.get_compliance_config", lambda _device: BARE_CONFIG
    )
    _run_group(client, superuser_token_headers, group_name)

    def preview() -> dict:
        r = client.post(
            f"{BASE}/groups/{group_name}/remediation-preview",
            headers=superuser_token_headers,
            json={"rule_ids": []},
        )
        assert r.status_code == 200
        return r.json()

    first = preview()
    assert preview()["commands_sha256"] == first["commands_sha256"]

    # a device joining the group without a run must not change the token
    latecomer = _make_device(db, groups=group_name)
    after = preview()
    late_entry = next(
        s for s in after["devices"] if s["hostname"] == latecomer.hostname
    )
    assert late_entry["status"] == "no_run"
    assert late_entry["commands"] == ""
    assert after["commands_sha256"] == first["commands_sha256"]

    _delete_device_via_api(client, superuser_token_headers, device.id)
    _delete_device_via_api(client, superuser_token_headers, latecomer.id)


def test_group_preview_marks_hardened_device_no_failures(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    monkeypatch,
):
    group_name = f"cmplok_{random_lower_string()[:8]}"
    device = _make_device(db, groups=group_name)
    monkeypatch.setattr(
        "app.api.routes.compliance.get_compliance_config", lambda _device: IOS_HARDENED
    )
    _run_group(client, superuser_token_headers, group_name)

    r = client.post(
        f"{BASE}/groups/{group_name}/remediation-preview",
        headers=superuser_token_headers,
        json={"rule_ids": []},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["total_devices"] == 0
    assert body["devices"][0]["status"] == "no_failures"

    _delete_device_via_api(client, superuser_token_headers, device.id)


def test_group_preview_requires_superuser(
    client: TestClient, normal_user_token_headers: dict[str, str]
):
    r = client.post(
        f"{BASE}/groups/nosuchgroup/remediation-preview",
        headers=normal_user_token_headers,
        json={"rule_ids": []},
    )
    assert r.status_code == 403


def test_group_remediate_guards(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    monkeypatch,
):
    group_name = f"cmplgd_{random_lower_string()[:8]}"
    device = _make_device(db, groups=group_name)
    monkeypatch.setattr(
        "app.api.routes.compliance.get_compliance_config", lambda _device: BARE_CONFIG
    )
    _run_group(client, superuser_token_headers, group_name)

    def remediate(payload: dict):
        return client.post(
            f"{BASE}/groups/{group_name}/remediate",
            headers=superuser_token_headers,
            json=payload,
        )

    assert remediate({"rule_ids": [], "confirm": False}).status_code == 400
    # confirm alone is not enough — the group endpoint requires the token
    no_sha = remediate({"rule_ids": [], "confirm": True})
    assert no_sha.status_code == 400
    assert "expected_commands_sha256" in no_sha.json()["detail"]
    stale = remediate(
        {"rule_ids": [], "confirm": True, "expected_commands_sha256": "deadbeef"}
    )
    assert stale.status_code == 409

    _delete_device_via_api(client, superuser_token_headers, device.id)


def test_group_remediate_empty_group_400(
    client: TestClient, superuser_token_headers: dict[str, str]
):
    r = client.post(
        f"{BASE}/groups/nosuchgroup_{random_lower_string()[:8]}/remediate",
        headers=superuser_token_headers,
        json={"rule_ids": [], "confirm": True, "expected_commands_sha256": "x"},
    )
    assert r.status_code == 400
    assert "No pending remediation" in r.json()["detail"]


def test_group_remediate_pushes_all_and_reruns(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    monkeypatch,
):
    group_name = f"cmplpush_{random_lower_string()[:8]}"
    device_a = _make_device(db, groups=group_name)
    device_b = _make_device(db, groups=group_name)
    monkeypatch.setattr(
        "app.api.routes.compliance.get_compliance_config", lambda _device: BARE_CONFIG
    )
    _run_group(client, superuser_token_headers, group_name)

    preview = client.post(
        f"{BASE}/groups/{group_name}/remediation-preview",
        headers=superuser_token_headers,
        json={"rule_ids": []},
    ).json()

    monkeypatch.setattr(
        "app.api.routes.compliance.snapshot_device_config",
        lambda *args, **kwargs: None,
    )
    monkeypatch.setattr(
        "app.api.routes.compliance.device_configure",
        lambda hostname, commands, command_type: {hostname: "OK"},
    )
    monkeypatch.setattr(
        "app.api.routes.compliance.get_compliance_config", lambda _device: IOS_HARDENED
    )

    r = client.post(
        f"{BASE}/groups/{group_name}/remediate",
        headers=superuser_token_headers,
        json={
            "rule_ids": [],
            "confirm": True,
            "expected_commands_sha256": preview["commands_sha256"],
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] is True
    assert body["pushed_count"] == 2
    assert body["error_count"] == 0
    assert all(res["status"] == "pushed" for res in body["results"])
    assert all(res["new_run_id"] is not None for res in body["results"])

    _delete_device_via_api(client, superuser_token_headers, device_a.id)
    _delete_device_via_api(client, superuser_token_headers, device_b.id)


def test_group_remediate_one_device_failure_does_not_abort_batch(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    monkeypatch,
):
    group_name = f"cmplpart_{random_lower_string()[:8]}"
    device_a = _make_device(db, groups=group_name)
    device_b = _make_device(db, groups=group_name)
    monkeypatch.setattr(
        "app.api.routes.compliance.get_compliance_config", lambda _device: BARE_CONFIG
    )
    _run_group(client, superuser_token_headers, group_name)

    preview = client.post(
        f"{BASE}/groups/{group_name}/remediation-preview",
        headers=superuser_token_headers,
        json={"rule_ids": []},
    ).json()

    broken = sorted([device_a.hostname, device_b.hostname])[0]
    monkeypatch.setattr(
        "app.api.routes.compliance.snapshot_device_config",
        lambda *args, **kwargs: None,
    )
    monkeypatch.setattr(
        "app.api.routes.compliance.device_configure",
        lambda hostname, commands, command_type: {
            hostname: "ERROR: connection refused" if hostname == broken else "OK"
        },
    )
    monkeypatch.setattr(
        "app.api.routes.compliance.get_compliance_config", lambda _device: IOS_HARDENED
    )

    r = client.post(
        f"{BASE}/groups/{group_name}/remediate",
        headers=superuser_token_headers,
        json={
            "rule_ids": [],
            "confirm": True,
            "expected_commands_sha256": preview["commands_sha256"],
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] is False
    assert body["pushed_count"] == 1
    assert body["error_count"] == 1
    assert any(broken in err for err in body["errors"])
    statuses = {res["hostname"]: res["status"] for res in body["results"]}
    assert statuses[broken] == "error"
    assert set(statuses.values()) == {"error", "pushed"}

    _delete_device_via_api(client, superuser_token_headers, device_a.id)
    _delete_device_via_api(client, superuser_token_headers, device_b.id)


def test_multi_value_profile_end_to_end(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    monkeypatch,
):
    original = client.get(f"{BASE}/profiles", headers=superuser_token_headers).json()[
        "global_profile"
    ]
    device = _make_device(db)
    monkeypatch.setattr(
        "app.api.routes.compliance.get_compliance_config", lambda _device: IOS_HARDENED
    )
    try:
        client.put(
            f"{BASE}/profiles/global",
            headers=superuser_token_headers,
            json={"ntp_server": "10.0.0.1,10.0.0.9"},
        )
        run = client.post(
            f"{BASE}/devices/{device.id}/run", headers=superuser_token_headers
        ).json()
        ntp = next(r for r in run["results"] if r["rule_id"] == "NTP-01")
        assert ntp["status"] == "fail"
        # only the missing server is remediated
        assert ntp["remediation_commands"] == "ntp server 10.0.0.9"
        assert "Missing: 10.0.0.9" in ntp["evidence"]
    finally:
        client.put(
            f"{BASE}/profiles/global",
            headers=superuser_token_headers,
            json={
                "ntp_server": original["ntp_server"],
                "syslog_server": original["syslog_server"],
                "dns_server": original["dns_server"],
                "password_min_length": original["password_min_length"],
                "exec_timeout_minutes": original["exec_timeout_minutes"],
            },
        )
        _delete_device_via_api(client, superuser_token_headers, device.id)
