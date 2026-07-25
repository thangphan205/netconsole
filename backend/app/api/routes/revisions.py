import asyncio
import difflib
import hashlib
from typing import Any

from fastapi import APIRouter, HTTPException, Request

from app.api.deps import CurrentUser, SessionDep
from app.automation.config_backup import get_running_config, replace_config
from app.automation.devices import DeviceAuthenticationError, DeviceConnectionError
from app.core import config_store
from app.core.config_store import ConfigStoreError
from app.crud.audit import write_audit_log
from app.crud.config_revisions import (
    get_previous_revision,
    get_revision,
    get_revisions,
    get_revisions_count,
    snapshot_device_config,
)
from app.models import (
    ConfigRevision,
    ConfigRevisionContentPublic,
    ConfigRevisionPublic,
    ConfigRevisionsPublic,
    Device,
    RevisionDiffPublic,
    RollbackPreviewPublic,
    RollbackRequest,
    RollbackResultPublic,
)

router = APIRouter()


def _get_device(session: SessionDep, id: int) -> Device:
    device = session.get(Device, id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device


def _get_revision_or_404(
    session: SessionDep, device_id: int, rev_id: int
) -> ConfigRevision:
    revision = get_revision(session, device_id, rev_id)
    if not revision:
        raise HTTPException(status_code=404, detail="Revision not found")
    return revision


def _require_superuser(current_user: CurrentUser) -> None:
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not enough permissions")


def _device_error(exc: Exception) -> HTTPException:
    if isinstance(exc, DeviceAuthenticationError):
        return HTTPException(
            status_code=400,
            detail=f"Authentication failed: wrong username/password. {exc}",
        )
    return HTTPException(status_code=400, detail=f"Connection failed: {exc}")


@router.post("/{id}/revisions", response_model=ConfigRevisionPublic | None)
async def create_revision(
    *,
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    id: int,
    action: str = "manual",
) -> Any:
    """
    Snapshot the device's running config into its revision history.
    Returns null when the config is unchanged since the last revision.
    """
    _require_superuser(current_user)
    device = _get_device(session, id)
    if action not in ("manual", "scheduled"):
        raise HTTPException(status_code=400, detail="Invalid action")
    try:
        revision = await asyncio.to_thread(
            snapshot_device_config,
            session,
            device,
            action=action,
            username=current_user.email,
            user_email=current_user.email,
        )
    except (DeviceAuthenticationError, DeviceConnectionError) as exc:
        raise _device_error(exc)
    except ConfigStoreError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    write_audit_log(
        session,
        username=current_user.email,
        action="snapshot_config",
        client_ip=request.client.host if request.client else "",
        message=f"Snapshot config of device {device.hostname}"
        + ("" if revision else " (no change)"),
    )
    return revision


@router.get("/{id}/revisions", response_model=ConfigRevisionsPublic)
def read_revisions(
    session: SessionDep,
    current_user: CurrentUser,
    id: int,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    List config revisions of a device, newest first.
    """
    _get_device(session, id)
    revisions = get_revisions(session, id, skip=skip, limit=limit)
    count = get_revisions_count(session, id)
    return ConfigRevisionsPublic(data=revisions, count=count)


@router.get("/{id}/revisions/{rev_id}", response_model=ConfigRevisionContentPublic)
def read_revision(
    session: SessionDep, current_user: CurrentUser, id: int, rev_id: int
) -> Any:
    """
    Get a revision's metadata and full config text.
    """
    _get_device(session, id)
    revision = _get_revision_or_404(session, id, rev_id)
    try:
        config = config_store.get_config_at(id, revision.commit_hash)
    except ConfigStoreError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return ConfigRevisionContentPublic(revision=revision, config=config)


@router.get("/{id}/revisions/{rev_id}/diff", response_model=RevisionDiffPublic)
async def read_revision_diff(
    session: SessionDep,
    current_user: CurrentUser,
    id: int,
    rev_id: int,
    against: str = "previous",
) -> Any:
    """
    Diff a revision against another revision id, "previous" or "live".
    """
    device = _get_device(session, id)
    revision = _get_revision_or_404(session, id, rev_id)
    try:
        if against == "live":
            stored = config_store.get_config_at(id, revision.commit_hash)
            live = await asyncio.to_thread(get_running_config, device)
            diff = "\n".join(
                difflib.unified_diff(
                    stored.splitlines(),
                    live.splitlines(),
                    fromfile=f"revision-{rev_id}",
                    tofile="live",
                    lineterm="",
                )
            )
        else:
            if against == "previous":
                base = get_previous_revision(session, revision)
                if not base:
                    raise HTTPException(status_code=404, detail="No previous revision")
            else:
                try:
                    base_id = int(against)
                except ValueError:
                    raise HTTPException(status_code=400, detail="Invalid against value")
                base = _get_revision_or_404(session, id, base_id)
            diff = config_store.diff_commits(id, base.commit_hash, revision.commit_hash)
    except (DeviceAuthenticationError, DeviceConnectionError) as exc:
        raise _device_error(exc)
    except ConfigStoreError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return RevisionDiffPublic(base_revision_id=rev_id, target=against, diff=diff)


@router.post(
    "/{id}/revisions/{rev_id}/rollback-preview", response_model=RollbackPreviewPublic
)
async def rollback_preview(
    *,
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    id: int,
    rev_id: int,
) -> Any:
    """
    Dry-run a rollback: load the revision's config on the device in replace
    mode and return the resulting diff without committing.
    """
    _require_superuser(current_user)
    device = _get_device(session, id)
    revision = _get_revision_or_404(session, id, rev_id)
    try:
        config_text = config_store.get_config_at(id, revision.commit_hash)
        result = await asyncio.to_thread(
            replace_config, device, config_text, dry_run=True
        )
    except (DeviceAuthenticationError, DeviceConnectionError) as exc:
        raise _device_error(exc)
    except ConfigStoreError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    diff = result["diff"]
    write_audit_log(
        session,
        username=current_user.email,
        action="rollback_preview",
        client_ip=request.client.host if request.client else "",
        message=f"Previewed rollback of device {device.hostname} to revision {rev_id}",
    )
    return RollbackPreviewPublic(
        revision_id=rev_id,
        diff=diff,
        diff_sha256=hashlib.sha256(diff.encode()).hexdigest(),
        caveats=result.get("caveats", ""),
    )


@router.post("/{id}/revisions/{rev_id}/rollback", response_model=RollbackResultPublic)
async def rollback(
    *,
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    id: int,
    rev_id: int,
    rollback_in: RollbackRequest,
) -> Any:
    """
    Execute a rollback to the given revision. Requires confirm=true; when
    expected_diff_sha256 (from the preview) is provided, the rollback is
    rejected with 409 if the device config drifted since the preview.
    """
    _require_superuser(current_user)
    device = _get_device(session, id)
    revision = _get_revision_or_404(session, id, rev_id)
    if not rollback_in.confirm:
        raise HTTPException(
            status_code=400,
            detail="Rollback requires confirm=true. Run rollback-preview first.",
        )
    if rollback_in.mode not in ("replace", "merge"):
        raise HTTPException(status_code=400, detail="Invalid mode")
    replace = rollback_in.mode == "replace"
    try:
        config_text = config_store.get_config_at(id, revision.commit_hash)
        if rollback_in.expected_diff_sha256:
            fresh = await asyncio.to_thread(
                replace_config, device, config_text, dry_run=True, replace=replace
            )
            fresh_sha = hashlib.sha256(fresh["diff"].encode()).hexdigest()
            if fresh_sha != rollback_in.expected_diff_sha256:
                raise HTTPException(
                    status_code=409,
                    detail="Device config changed since preview. Re-run rollback-preview.",
                )
        result = await asyncio.to_thread(
            replace_config, device, config_text, dry_run=False, replace=replace
        )
    except (DeviceAuthenticationError, DeviceConnectionError) as exc:
        raise _device_error(exc)
    except ConfigStoreError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    new_revision_id = None
    message = ""
    try:
        new_revision = await asyncio.to_thread(
            snapshot_device_config,
            session,
            device,
            action="rollback",
            username=current_user.email,
            user_email=current_user.email,
            message=f"rollback to revision {rev_id} ({rollback_in.mode})",
        )
        if new_revision:
            new_revision_id = new_revision.id
    except Exception as exc:  # snapshot failure must not mask a done rollback
        message = f"Rollback applied but post-rollback snapshot failed: {exc}"
    write_audit_log(
        session,
        username=current_user.email,
        action="rollback_config",
        client_ip=request.client.host if request.client else "",
        message=f"Rolled back device {device.hostname} to revision {rev_id} "
        f"(mode={rollback_in.mode})",
        severity="WARNING",
    )
    return RollbackResultPublic(
        status=True,
        diff=result["diff"],
        new_revision_id=new_revision_id,
        message=message,
    )
