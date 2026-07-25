import hashlib

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, delete

from app.core import config_store
from app.core.config import settings
from app.crud import config_revisions as crud_revisions
from app.models import ConfigRevision, Device


@pytest.fixture(autouse=True)
def repo_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "CONFIG_REPO_DIR", str(tmp_path))
    return tmp_path


@pytest.fixture
def device(db: Session):
    sw = Device(hostname="testsw1", ipaddress="192.0.2.10", platform="ios")
    db.add(sw)
    db.commit()
    db.refresh(sw)
    yield sw
    db.exec(delete(ConfigRevision).where(ConfigRevision.device_id == sw.id))
    db.delete(sw)
    db.commit()


def test_commit_and_read_config():
    commit_hash, changed = config_store.commit_config(
        1,
        "hostname sw1\ninterface Gi0/1\n",
        message="manual: sw1",
        author_name="alice",
        author_email="alice@example.com",
    )
    assert changed is True
    assert config_store.get_config_at(1, commit_hash) == (
        "hostname sw1\ninterface Gi0/1\n"
    )


def test_commit_unchanged_returns_head():
    first, changed1 = config_store.commit_config(
        2, "hostname sw2\n", message="m", author_name="a", author_email="a@b"
    )
    second, changed2 = config_store.commit_config(
        2, "hostname sw2\n", message="m", author_name="a", author_email="a@b"
    )
    assert changed1 is True
    assert changed2 is False
    assert first == second


def test_diff_commits():
    h1, _ = config_store.commit_config(
        3, "hostname old\n", message="m", author_name="a", author_email="a@b"
    )
    h2, _ = config_store.commit_config(
        3, "hostname new\n", message="m", author_name="a", author_email="a@b"
    )
    diff = config_store.diff_commits(3, h1, h2)
    assert "-hostname old" in diff
    assert "+hostname new" in diff


def test_snapshot_records_revision(db: Session, device: Device, monkeypatch):
    monkeypatch.setattr(
        crud_revisions, "get_running_config", lambda sw: "hostname testsw1\n"
    )
    revision = crud_revisions.snapshot_device_config(
        db,
        device,
        action="manual",
        username="alice@example.com",
        user_email="alice@example.com",
    )
    assert revision is not None
    assert revision.action == "manual"
    assert config_store.get_config_at(device.id, revision.commit_hash) == (
        "hostname testsw1\n"
    )

    # unchanged manual snapshot is a no-op
    again = crud_revisions.snapshot_device_config(
        db,
        device,
        action="manual",
        username="alice@example.com",
        user_email="alice@example.com",
    )
    assert again is None

    # pre_push is recorded even when unchanged
    pre = crud_revisions.snapshot_device_config(
        db,
        device,
        action="pre_push",
        username="alice@example.com",
        user_email="alice@example.com",
    )
    assert pre is not None
    assert pre.commit_hash == revision.commit_hash


def test_rollback_requires_confirm(
    client: TestClient,
    superuser_token_headers,
    db: Session,
    device: Device,
    monkeypatch,
):
    monkeypatch.setattr(
        crud_revisions, "get_running_config", lambda sw: "hostname testsw1\n"
    )
    revision = crud_revisions.snapshot_device_config(
        db,
        device,
        action="manual",
        username="a@b",
        user_email="a@b",
    )
    response = client.post(
        f"{settings.API_V1_STR}/devices/{device.id}/revisions/{revision.id}/rollback",
        headers=superuser_token_headers,
        json={"confirm": False},
    )
    assert response.status_code == 400
    assert "confirm" in response.json()["detail"]


def test_rollback_409_on_drift(
    client: TestClient,
    superuser_token_headers,
    db: Session,
    device: Device,
    monkeypatch,
):
    from app.api.routes import revisions as revisions_route

    monkeypatch.setattr(
        crud_revisions, "get_running_config", lambda sw: "hostname testsw1\n"
    )
    revision = crud_revisions.snapshot_device_config(
        db,
        device,
        action="manual",
        username="a@b",
        user_email="a@b",
    )
    monkeypatch.setattr(
        revisions_route,
        "replace_config",
        lambda sw, cfg, dry_run, replace=True: {
            "diff": "+hostname drifted",
            "changed": True,
            "caveats": "",
        },
    )
    stale_sha = hashlib.sha256(b"different diff").hexdigest()
    response = client.post(
        f"{settings.API_V1_STR}/devices/{device.id}/revisions/{revision.id}/rollback",
        headers=superuser_token_headers,
        json={"confirm": True, "expected_diff_sha256": stale_sha},
    )
    assert response.status_code == 409


def test_revisions_forbidden_for_normal_user(
    client: TestClient, normal_user_token_headers, device: Device
):
    response = client.post(
        f"{settings.API_V1_STR}/devices/{device.id}/revisions",
        headers=normal_user_token_headers,
    )
    assert response.status_code == 403
