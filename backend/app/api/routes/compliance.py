import asyncio
import hashlib
import json
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from sqlmodel import col, select

from app.api.deps import CurrentUser, SessionDep
from app.automation.compliance_rules import RULES, evaluate_rules, normalize_platform
from app.automation.config_backup import get_compliance_config
from app.automation.device_config import device_configure
from app.automation.devices import DeviceAuthenticationError, DeviceConnectionError
from app.crud import compliance as compliance_crud
from app.crud.audit import write_audit_log
from app.crud.config_revisions import snapshot_device_config
from app.models import (
    ComplianceProfilePublic,
    ComplianceProfilesPublic,
    ComplianceProfileUpdate,
    ComplianceResult,
    ComplianceRulePublic,
    ComplianceRulesPublic,
    ComplianceRun,
    ComplianceRunDetailPublic,
    ComplianceSummaryPublic,
    Device,
    Group,
    GroupRemediationDevicePreview,
    GroupRemediationDeviceResult,
    GroupRemediationPreviewPublic,
    GroupRemediationPreviewRequest,
    GroupRemediationRequest,
    GroupRemediationResultPublic,
    RemediationPreviewPublic,
    RemediationPreviewRequest,
    RemediationRequest,
    RemediationResultPublic,
)

router = APIRouter()


def _get_device(session: SessionDep, id: int) -> Device:
    device = session.get(Device, id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device


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


def _run_detail(session: SessionDep, run: ComplianceRun) -> ComplianceRunDetailPublic:
    results = compliance_crud.get_run_results(session, run.id)  # type: ignore[arg-type]
    return ComplianceRunDetailPublic(run=run, results=results)


async def _run_check(
    session: SessionDep, current_user: CurrentUser, device: Device
) -> ComplianceRun:
    plat = normalize_platform(device.platform)
    if not plat:
        raise HTTPException(
            status_code=400,
            detail=f"Compliance checks are not supported for platform "
            f"'{device.platform}'",
        )
    profile = compliance_crud.effective_profile_for_device(session, device)
    try:
        config_text = await asyncio.to_thread(get_compliance_config, device)
    except (DeviceAuthenticationError, DeviceConnectionError) as exc:
        raise _device_error(exc)

    results = evaluate_rules(config_text, device.platform, profile)
    run = compliance_crud.create_run(
        session,
        device_id=device.id,  # type: ignore[arg-type]
        platform=plat,
        username=current_user.email,
        status="completed",
        profile_snapshot=json.dumps(profile, default=str),
        results=[
            {
                "rule_id": r.rule_id,
                "status": r.status,
                "evidence": r.evidence,
                "remediation_commands": r.remediation_commands,
            }
            for r in results
        ],
    )
    return run


def _rule_commands(session: SessionDep, run: ComplianceRun, rule_ids: list[str]) -> str:
    results = compliance_crud.get_run_results(session, run.id)  # type: ignore[arg-type]
    by_id = {r.rule_id: r for r in results}
    commands: list[str] = []
    for rule_id in rule_ids:
        result = by_id.get(rule_id)
        if not result or result.status != "fail" or not result.remediation_commands:
            raise HTTPException(
                status_code=400,
                detail=f"Rule '{rule_id}' has no pending remediation on run {run.id}",
            )
        commands.append(result.remediation_commands)
    return "\n".join(commands)


def _failed_results(
    session: SessionDep, run: ComplianceRun, rule_ids: list[str]
) -> list[ComplianceResult]:
    """Non-raising counterpart to `_rule_commands`, for group planning.

    A rule may fail on one device and pass on another, so a group plan must
    skip rules that have no pending remediation rather than reject the batch.
    Results come back in catalog order (the stored row order), independent of
    the order the caller listed `rule_ids` in, so the hash stays deterministic.
    """
    wanted = set(rule_ids)
    return [
        r
        for r in compliance_crud.get_run_results(session, run.id)  # type: ignore[arg-type]
        if r.status == "fail"
        and r.remediation_commands
        and (not wanted or r.rule_id in wanted)
    ]


def _group_devices(session: SessionDep, group_name: str) -> list[Device]:
    """Members of a group, in a stable order the aggregate hash depends on.

    NOTE: `contains` is substring matching on the CSV `groups` column, so group
    "core" also selects devices in "core-east". Pre-existing behavior shared
    with run_group_check and group_config.py; kept for parity.
    """
    statement = select(Device).where(col(Device.groups).contains(group_name))
    devices = list(session.exec(statement).all())
    # hostname is not unique, so tie-break on id
    return sorted(devices, key=lambda s: (s.hostname, s.id or 0))


def _build_group_plan(
    session: SessionDep, group_name: str, rule_ids: list[str]
) -> tuple[list[GroupRemediationDevicePreview], str]:
    """Build the per-device remediation plan plus its aggregate sha256 token.

    Used by both the group preview and the group push so the token compared on
    push is computed from the exact same code path that produced it.
    """
    previews: list[GroupRemediationDevicePreview] = []
    for device in _group_devices(session, group_name):
        assert device.id is not None
        preview = GroupRemediationDevicePreview(
            device_id=device.id, hostname=device.hostname, platform=device.platform
        )
        if not normalize_platform(device.platform):
            preview.status = "unsupported_platform"
            preview.message = (
                f"Compliance checks are not supported for platform '{device.platform}'"
            )
            previews.append(preview)
            continue

        run = compliance_crud.get_latest_run(session, device.id)
        if not run:
            preview.status = "no_run"
            preview.message = "No compliance run yet — run the group check first."
            previews.append(preview)
            continue

        preview.run_id = run.id
        failed = _failed_results(session, run, rule_ids)
        if not failed:
            preview.status = "no_failures"
            preview.message = "No pending remediation."
            previews.append(preview)
            continue

        preview.status = "ready"
        preview.rule_ids = [r.rule_id for r in failed]
        preview.commands = "\n".join(r.remediation_commands for r in failed)
        preview.commands_sha256 = hashlib.sha256(preview.commands.encode()).hexdigest()
        previews.append(preview)

    # Hash the ready devices only, via canonical JSON — command text contains
    # newlines, so a plain delimiter could collide. run_id is included on
    # purpose: a compliance check that lands between preview and push makes the
    # plan stale even when the commands are identical.
    canonical = json.dumps(
        [
            {
                "hostname": p.hostname,
                "run_id": p.run_id,
                "rule_ids": p.rule_ids,
                "commands": p.commands,
            }
            for p in previews
            if p.status == "ready"
        ],
        sort_keys=True,
        separators=(",", ":"),
    )
    return previews, hashlib.sha256(canonical.encode()).hexdigest()


async def _snapshot(
    session: SessionDep,
    device: Device,
    current_user: CurrentUser,
    action: str,
    **kwargs: str,
) -> str:
    """Commit a config revision. Returns "" or a warning — never raises, since
    a snapshot failure must not block or unwind a push."""
    try:
        await asyncio.to_thread(
            snapshot_device_config,
            session,
            device,
            action=action,
            username=current_user.email,
            user_email=current_user.email,
            **kwargs,
        )
    except Exception as exc:  # noqa: BLE001
        # Clear the half-applied transaction so the shared session stays usable
        # for the remaining devices and the audit log.
        session.rollback()
        return f"{device.hostname}: {action} snapshot failed: {exc}"
    return ""


@router.get("/rules", response_model=ComplianceRulesPublic)
def read_rules(current_user: CurrentUser) -> Any:
    """
    List the code-defined hardening rule catalog with PCI DSS v4.0.1 and
    ISO 27001:2022 mappings.
    """
    return ComplianceRulesPublic(
        data=[
            ComplianceRulePublic(
                id=rule.id,
                title=rule.title,
                description=rule.description,
                severity=rule.severity,
                pci_dss=rule.pci_dss,
                iso27001=rule.iso27001,
                variables=rule.variables,
                platforms=list(rule.platforms.keys()),
            )
            for rule in RULES
        ]
    )


@router.get("/profiles", response_model=ComplianceProfilesPublic)
def read_profiles(session: SessionDep, current_user: CurrentUser) -> Any:
    """
    Get the global compliance profile and all per-group overrides.
    """
    global_profile = compliance_crud.get_or_create_global_profile(session)
    group_profiles = compliance_crud.get_group_profiles(session)
    return ComplianceProfilesPublic(
        global_profile=global_profile,
        group_profiles=group_profiles,
    )


@router.put("/profiles/global", response_model=ComplianceProfilePublic)
def update_global_profile(
    *,
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    profile_in: ComplianceProfileUpdate,
) -> Any:
    """
    Update the global compliance profile (NTP/syslog/DNS servers, password
    policy, exec-timeout). Fields omitted from the request are left unchanged.
    """
    _require_superuser(current_user)
    profile = compliance_crud.upsert_global_profile(session, profile_in)
    write_audit_log(
        session,
        username=current_user.email,
        action="update_compliance_profile",
        client_ip=request.client.host if request.client else "",
        message="Updated global compliance profile",
    )
    return profile


@router.put("/profiles/group/{group_id}", response_model=ComplianceProfilePublic)
def update_group_profile(
    *,
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    group_id: int,
    profile_in: ComplianceProfileUpdate,
) -> Any:
    """
    Upsert a per-group compliance profile override. Only non-null fields
    override the global profile for devices in this group.
    """
    _require_superuser(current_user)
    if not session.get(Group, group_id):
        raise HTTPException(status_code=404, detail="Group not found")
    profile = compliance_crud.upsert_group_profile(session, group_id, profile_in)
    write_audit_log(
        session,
        username=current_user.email,
        action="update_compliance_profile",
        client_ip=request.client.host if request.client else "",
        message=f"Updated compliance profile override for group {group_id}",
    )
    return profile


@router.delete("/profiles/group/{group_id}")
def delete_group_profile(
    *,
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    group_id: int,
) -> Any:
    """
    Remove a group's compliance profile override (devices in the group fall
    back to the global profile).
    """
    _require_superuser(current_user)
    deleted = compliance_crud.delete_group_profile(session, group_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Group profile override not found")
    write_audit_log(
        session,
        username=current_user.email,
        action="delete_compliance_profile",
        client_ip=request.client.host if request.client else "",
        message=f"Deleted compliance profile override for group {group_id}",
    )
    return {"status": True}


@router.post("/devices/{id}/run", response_model=ComplianceRunDetailPublic)
async def run_device_check(
    *,
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    id: int,
) -> Any:
    """
    Fetch the device's live config and evaluate it against the hardening
    rule catalog, persisting a new compliance run.
    """
    _require_superuser(current_user)
    device = _get_device(session, id)
    run = await _run_check(session, current_user, device)
    write_audit_log(
        session,
        username=current_user.email,
        action="compliance_check",
        client_ip=request.client.host if request.client else "",
        message=f"Ran compliance check on device {device.hostname}: "
        f"{run.passed_count} passed, {run.failed_count} failed, "
        f"{run.skipped_count} skipped",
    )
    return _run_detail(session, run)


@router.get("/devices/{id}/latest", response_model=ComplianceRunDetailPublic)
def read_latest_run(session: SessionDep, current_user: CurrentUser, id: int) -> Any:
    """
    Get the most recent compliance run and its results for a device.
    """
    _get_device(session, id)
    run = compliance_crud.get_latest_run(session, id)
    if not run:
        raise HTTPException(status_code=404, detail="No compliance run yet")
    return _run_detail(session, run)


@router.get("/runs/{run_id}", response_model=ComplianceRunDetailPublic)
def read_run(session: SessionDep, current_user: CurrentUser, run_id: int) -> Any:
    """
    Get a compliance run and its results by id.
    """
    run = compliance_crud.get_run(session, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Compliance run not found")
    return _run_detail(session, run)


@router.get("/summary", response_model=ComplianceSummaryPublic)
def read_summary(session: SessionDep, current_user: CurrentUser) -> Any:
    """
    Latest compliance run counts per device, for the dashboard.
    """
    return ComplianceSummaryPublic(data=compliance_crud.latest_runs_summary(session))


@router.post("/groups/{group_name}/run")
async def run_group_check(
    *,
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    group_name: str,
) -> Any:
    """
    Run compliance checks against every device in a group.
    """
    _require_superuser(current_user)
    statement = select(Device).where(col(Device.groups).contains(group_name))
    devices = list(session.exec(statement).all())

    run_ids: dict[str, int] = {}
    errors: list[str] = []
    for device in devices:
        try:
            run = await _run_check(session, current_user, device)
            run_ids[device.hostname] = run.id  # type: ignore[assignment]
        except HTTPException as exc:
            session.rollback()
            errors.append(f"{device.hostname}: {exc.detail}")
        except Exception as exc:  # noqa: BLE001
            session.rollback()
            errors.append(f"{device.hostname}: {exc}")

    write_audit_log(
        session,
        username=current_user.email,
        action="compliance_check",
        client_ip=request.client.host if request.client else "",
        message=f"Ran compliance check on group {group_name}: "
        f"{len(run_ids)} succeeded, {len(errors)} failed",
    )
    return {"run_ids": run_ids, "errors": errors}


@router.post(
    "/devices/{id}/remediation-preview", response_model=RemediationPreviewPublic
)
def remediation_preview(
    *,
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    id: int,
    preview_in: RemediationPreviewRequest,
) -> Any:
    """
    Build the remediation commands for a set of failed rules from a stored
    compliance run (no device contact). Returns a sha256 token that must be
    echoed back to /remediate to guard against a stale preview.
    """
    _require_superuser(current_user)
    device = _get_device(session, id)
    run = compliance_crud.get_run(session, preview_in.run_id)
    if not run or run.device_id != id:
        raise HTTPException(status_code=404, detail="Compliance run not found")
    commands = _rule_commands(session, run, preview_in.rule_ids)
    caveats = (
        "IOS config replace requires the 'archive' feature for full replace; "
        "this push uses merge mode so that caveat does not apply."
        if device.platform == "ios"
        else ""
    )
    return RemediationPreviewPublic(
        commands=commands,
        commands_sha256=hashlib.sha256(commands.encode()).hexdigest(),
        rule_ids=preview_in.rule_ids,
        caveats=caveats,
    )


@router.post("/devices/{id}/remediate", response_model=RemediationResultPublic)
async def remediate(
    *,
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    id: int,
    remediate_in: RemediationRequest,
) -> Any:
    """
    Push remediation commands for the given failed rules (merge mode, with
    pre/post config snapshots) then re-run the compliance check. Requires
    confirm=true and expected_commands_sha256 matching the preview's token.
    """
    _require_superuser(current_user)
    device = _get_device(session, id)
    run = compliance_crud.get_run(session, remediate_in.run_id)
    if not run or run.device_id != id:
        raise HTTPException(status_code=404, detail="Compliance run not found")
    if not remediate_in.confirm:
        raise HTTPException(
            status_code=400,
            detail="Remediation requires confirm=true. Run remediation-preview first.",
        )
    commands = _rule_commands(session, run, remediate_in.rule_ids)
    commands_sha256 = hashlib.sha256(commands.encode()).hexdigest()
    if (
        remediate_in.expected_commands_sha256
        and commands_sha256 != remediate_in.expected_commands_sha256
    ):
        raise HTTPException(
            status_code=409,
            detail="Remediation commands changed since preview. Re-run "
            "remediation-preview.",
        )

    await _snapshot(session, device, current_user, "pre_push")
    try:
        push_result = await asyncio.to_thread(
            device_configure, device.hostname, commands, "config"
        )
    except (DeviceAuthenticationError, DeviceConnectionError) as exc:
        raise _device_error(exc)
    output = push_result.get(device.hostname, "")
    if output.startswith("ERROR:"):
        raise HTTPException(status_code=400, detail=f"Push failed: {output}")
    await _snapshot(
        session,
        device,
        current_user,
        "post_push",
        commands=commands,
        command_type="config",
    )

    write_audit_log(
        session,
        username=current_user.email,
        action="compliance_remediate",
        client_ip=request.client.host if request.client else "",
        message=f"Remediated {len(remediate_in.rule_ids)} rule(s) on device "
        f"{device.hostname}: {', '.join(remediate_in.rule_ids)}",
        severity="WARNING",
    )

    new_run = await _run_check(session, current_user, device)
    return RemediationResultPublic(
        status=True,
        new_run_id=new_run.id,
        message=f"Pushed remediation for {len(remediate_in.rule_ids)} rule(s)",
    )


@router.post(
    "/groups/{group_name}/remediation-preview",
    response_model=GroupRemediationPreviewPublic,
)
def group_remediation_preview(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    group_name: str,
    preview_in: GroupRemediationPreviewRequest,
) -> Any:
    """
    Build the per-device remediation plan for a group from each device's latest
    stored run (no device contact). Returns an aggregate sha256 that must be
    echoed back to /remediate.
    """
    _require_superuser(current_user)
    previews, aggregate_sha256 = _build_group_plan(
        session, group_name, preview_in.rule_ids
    )
    ready = [p for p in previews if p.status == "ready"]

    platforms = {
        normalize_platform(p.platform) for p in ready if normalize_platform(p.platform)
    }
    caveat_parts: list[str] = []
    if "ios" in platforms:
        caveat_parts.append(
            "IOS config replace requires the 'archive' feature for full replace; "
            "this push uses merge mode so that caveat does not apply."
        )
    if len(platforms) > 1:
        caveat_parts.append(
            f"Group spans {len(platforms)} platforms "
            f"({', '.join(sorted(str(p) for p in platforms))}); "
            "commands differ per device."
        )

    return GroupRemediationPreviewPublic(
        group_name=group_name,
        devices=previews,
        commands_sha256=aggregate_sha256,
        total_devices=len(ready),
        total_rules=sum(len(p.rule_ids) for p in ready),
        caveats=" ".join(caveat_parts),
    )


@router.post(
    "/groups/{group_name}/remediate", response_model=GroupRemediationResultPublic
)
async def group_remediate(
    *,
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    group_name: str,
    remediate_in: GroupRemediationRequest,
) -> Any:
    """
    Push each group member's own pending remediation commands (merge mode, with
    pre/post config snapshots) then re-run its compliance check. Requires
    confirm=true and expected_commands_sha256 from a group remediation-preview.

    One unreachable device does not abort the batch: per-device outcomes are
    returned in the body and the response stays 200.
    """
    _require_superuser(current_user)
    if not remediate_in.confirm:
        raise HTTPException(
            status_code=400,
            detail="Remediation requires confirm=true. Run remediation-preview first.",
        )

    previews, aggregate_sha256 = _build_group_plan(
        session, group_name, remediate_in.rule_ids
    )
    ready = [p for p in previews if p.status == "ready"]
    if not ready:
        raise HTTPException(
            status_code=400,
            detail=f"No pending remediation for group '{group_name}'",
        )
    # Unlike the single-device endpoint, the token is mandatory here — a group
    # push has N times the blast radius and no legitimate caller skips preview.
    if not remediate_in.expected_commands_sha256:
        raise HTTPException(
            status_code=400,
            detail="Group remediation requires expected_commands_sha256 from "
            "remediation-preview.",
        )
    if remediate_in.expected_commands_sha256 != aggregate_sha256:
        raise HTTPException(
            status_code=409,
            detail="Remediation commands changed since preview. Re-run "
            "remediation-preview.",
        )

    client_ip = request.client.host if request.client else ""
    results: list[GroupRemediationDeviceResult] = []
    errors: list[str] = []
    snapshot_warnings: list[str] = []
    pushed_count = 0

    for preview in previews:
        if preview.status != "ready":
            results.append(
                GroupRemediationDeviceResult(
                    device_id=preview.device_id,
                    hostname=preview.hostname,
                    status="skipped",
                    message=preview.message,
                )
            )
            continue

        device = session.get(Device, preview.device_id)
        if not device:
            errors.append(f"{preview.hostname}: device disappeared mid-push")
            results.append(
                GroupRemediationDeviceResult(
                    device_id=preview.device_id,
                    hostname=preview.hostname,
                    status="error",
                    message="Device not found",
                )
            )
            continue

        def record_error(
            message: str, plan: GroupRemediationDevicePreview = preview
        ) -> None:
            errors.append(f"{plan.hostname}: {message}")
            results.append(
                GroupRemediationDeviceResult(
                    device_id=plan.device_id,
                    hostname=plan.hostname,
                    status="error",
                    rule_ids=plan.rule_ids,
                    message=message,
                )
            )

        warning = await _snapshot(session, device, current_user, "pre_push")
        if warning:
            snapshot_warnings.append(warning)

        try:
            push_result = await asyncio.to_thread(
                device_configure, device.hostname, preview.commands, "config"
            )
        except Exception as exc:  # noqa: BLE001
            session.rollback()
            record_error(f"Push failed: {exc}")
            continue

        output = push_result.get(device.hostname, "")
        if output.startswith("ERROR:"):
            record_error(f"Push failed: {output}")
            continue

        warning = await _snapshot(
            session,
            device,
            current_user,
            "post_push",
            commands=preview.commands,
            command_type="config",
        )
        if warning:
            snapshot_warnings.append(warning)

        write_audit_log(
            session,
            username=current_user.email,
            action="compliance_remediate",
            client_ip=client_ip,
            message=f"Remediated {len(preview.rule_ids)} rule(s) on device "
            f"{device.hostname}: {', '.join(preview.rule_ids)}",
            severity="WARNING",
        )
        pushed_count += 1

        # The push already happened, so a failed verification re-run must still
        # be recorded as "pushed" — losing that record is worse than a stale
        # dashboard count.
        new_run_id: int | None = None
        message = ""
        if remediate_in.rerun_check:
            try:
                new_run = await _run_check(session, current_user, device)
                new_run_id = new_run.id
            except HTTPException as exc:
                session.rollback()
                message = f"pushed, but post-push verification failed: {exc.detail}"
            except Exception as exc:  # noqa: BLE001
                session.rollback()
                message = f"pushed, but post-push verification failed: {exc}"
        results.append(
            GroupRemediationDeviceResult(
                device_id=preview.device_id,
                hostname=preview.hostname,
                status="pushed",
                rule_ids=preview.rule_ids,
                new_run_id=new_run_id,
                message=message,
            )
        )

    error_count = sum(1 for r in results if r.status == "error")
    skipped_count = sum(1 for r in results if r.status == "skipped")
    write_audit_log(
        session,
        username=current_user.email,
        action="compliance_remediate",
        client_ip=client_ip,
        message=f"Remediated group {group_name}: {pushed_count} pushed, "
        f"{error_count} failed, {skipped_count} skipped",
        severity="WARNING",
    )
    if snapshot_warnings:
        write_audit_log(
            session,
            username=current_user.email,
            action="snapshot_config",
            client_ip=client_ip,
            message=f"Group {group_name}: " + "; ".join(snapshot_warnings),
            severity="WARNING",
        )

    return GroupRemediationResultPublic(
        group_name=group_name,
        status=error_count == 0 and pushed_count > 0,
        pushed_count=pushed_count,
        skipped_count=skipped_count,
        error_count=error_count,
        results=results,
        errors=errors,
        snapshot_warning="; ".join(snapshot_warnings),
        message=f"{pushed_count} device(s) remediated, {error_count} failed, "
        f"{skipped_count} skipped",
    )
