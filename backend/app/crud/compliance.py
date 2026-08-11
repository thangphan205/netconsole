from datetime import UTC, datetime
from typing import Any

from sqlmodel import Session, col, delete, select

from app.models import (
    ComplianceManualEvidence,
    ComplianceProfile,
    ComplianceProfileUpdate,
    ComplianceResult,
    ComplianceRun,
    Device,
    Group,
)

PROFILE_FIELDS = (
    "ntp_server",
    "syslog_server",
    "syslog_severity",
    "dns_server",
    "password_min_length",
    "exec_timeout_minutes",
    "disabled_rules",
)

DEFAULT_GLOBAL_PROFILE = {
    "syslog_severity": "any notice",
    "password_min_length": 12,
    "exec_timeout_minutes": 10,
}


def get_or_create_global_profile(session: Session) -> ComplianceProfile:
    statement = select(ComplianceProfile).where(
        col(ComplianceProfile.group_id).is_(None)
    )
    profile = session.exec(statement).first()
    if profile:
        return profile
    profile = ComplianceProfile(group_id=None, **DEFAULT_GLOBAL_PROFILE)
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile


def get_group_profiles(session: Session) -> list[ComplianceProfile]:
    statement = select(ComplianceProfile).where(
        col(ComplianceProfile.group_id).is_not(None)
    )
    return list(session.exec(statement).all())


def get_group_profile(session: Session, group_id: int) -> ComplianceProfile | None:
    statement = select(ComplianceProfile).where(ComplianceProfile.group_id == group_id)
    return session.exec(statement).first()


def upsert_global_profile(
    session: Session, profile_in: ComplianceProfileUpdate
) -> ComplianceProfile:
    profile = get_or_create_global_profile(session)
    update_data = profile_in.model_dump(exclude_unset=True)
    profile.sqlmodel_update(update_data)
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile


def upsert_group_profile(
    session: Session, group_id: int, profile_in: ComplianceProfileUpdate
) -> ComplianceProfile:
    profile = get_group_profile(session, group_id)
    if not profile:
        profile = ComplianceProfile(group_id=group_id)
    update_data = profile_in.model_dump(exclude_unset=True)
    profile.sqlmodel_update(update_data)
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile


def delete_group_profile(session: Session, group_id: int) -> bool:
    profile = get_group_profile(session, group_id)
    if not profile:
        return False
    session.delete(profile)
    session.commit()
    return True


def effective_profile_for_device(
    session: Session, device: Device
) -> dict[str, str | int | None]:
    """Merge group-profile overrides (sorted by group name, for determinism)
    over the global default profile. A None/unset field in an override does
    not clear an already-merged value."""
    global_profile = get_or_create_global_profile(session)
    effective = {field: getattr(global_profile, field) for field in PROFILE_FIELDS}
    if effective.get("syslog_severity") is None:
        effective["syslog_severity"] = "any notice"

    disabled_set: set[str] = set()
    global_disabled = getattr(global_profile, "disabled_rules", None)
    if global_disabled:
        disabled_set.update(
            r.strip() for r in str(global_disabled).split(",") if r.strip()
        )

    device_groups = [g.strip() for g in (device.groups or "").split(",") if g.strip()]
    if not device_groups:
        effective["disabled_rules"] = (
            ",".join(sorted(disabled_set)) if disabled_set else None
        )
        return effective

    statement = select(Group).where(col(Group.name).in_(device_groups))
    matched_groups = sorted(session.exec(statement).all(), key=lambda g: g.name)

    for group in matched_groups:
        assert group.id is not None
        override = get_group_profile(session, group.id)
        if not override:
            continue
        for field in PROFILE_FIELDS:
            value = getattr(override, field)
            if value is not None:
                if field == "disabled_rules":
                    disabled_set.update(
                        r.strip() for r in str(value).split(",") if r.strip()
                    )
                else:
                    effective[field] = value

    effective["disabled_rules"] = (
        ",".join(sorted(disabled_set)) if disabled_set else None
    )
    return effective


def create_run(
    session: Session,
    *,
    device_id: int,
    platform: str,
    username: str,
    status: str,
    error: str = "",
    profile_snapshot: str = "",
    results: list[dict[str, Any]],
) -> ComplianceRun:
    passed = sum(1 for r in results if r["status"] == "pass")
    failed = sum(1 for r in results if r["status"] == "fail")
    skipped = sum(1 for r in results if r["status"] == "skipped")

    run = ComplianceRun(
        device_id=device_id,
        platform=platform,
        username=username,
        status=status,
        error=error,
        profile_snapshot=profile_snapshot,
        passed_count=passed,
        failed_count=failed,
        skipped_count=skipped,
    )
    session.add(run)
    session.commit()
    session.refresh(run)

    for r in results:
        session.add(
            ComplianceResult(
                run_id=run.id,
                rule_id=r["rule_id"],
                status=r["status"],
                evidence=r.get("evidence", ""),
                remediation_commands=r.get("remediation_commands", ""),
                is_manual=bool(r.get("is_manual", False)),
            )
        )
    session.commit()
    return run


def get_manual_evidence_map(
    session: Session, device_id: int
) -> dict[str, ComplianceManualEvidence]:
    statement = select(ComplianceManualEvidence).where(
        ComplianceManualEvidence.device_id == device_id
    )
    return {row.rule_id: row for row in session.exec(statement).all()}


def upsert_manual_evidence(
    session: Session,
    *,
    device_id: int,
    rule_id: str,
    evidence: str,
    attested_by: str,
) -> ComplianceManualEvidence:
    statement = select(ComplianceManualEvidence).where(
        ComplianceManualEvidence.device_id == device_id,
        ComplianceManualEvidence.rule_id == rule_id,
    )
    record = session.exec(statement).first()
    if record:
        record.evidence = evidence
        record.attested_by = attested_by
        record.attested_at = datetime.now(UTC)
    else:
        record = ComplianceManualEvidence(
            device_id=device_id,
            rule_id=rule_id,
            evidence=evidence,
            attested_by=attested_by,
        )
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def delete_manual_evidence(session: Session, *, device_id: int, rule_id: str) -> bool:
    statement = select(ComplianceManualEvidence).where(
        ComplianceManualEvidence.device_id == device_id,
        ComplianceManualEvidence.rule_id == rule_id,
    )
    record = session.exec(statement).first()
    if not record:
        return False
    session.delete(record)
    session.commit()
    return True


def get_run(session: Session, run_id: int) -> ComplianceRun | None:
    return session.get(ComplianceRun, run_id)


def get_run_results(session: Session, run_id: int) -> list[ComplianceResult]:
    statement = (
        select(ComplianceResult)
        .where(ComplianceResult.run_id == run_id)
        .order_by(col(ComplianceResult.id))
    )
    return list(session.exec(statement).all())


def get_latest_run(session: Session, device_id: int) -> ComplianceRun | None:
    statement = (
        select(ComplianceRun)
        .where(ComplianceRun.device_id == device_id)
        .order_by(col(ComplianceRun.id).desc())
        .limit(1)
    )
    return session.exec(statement).first()


def group_member_devices(session: Session, group_name: str) -> list[Device]:
    """Members of a group, in a stable order the aggregate hash depends on."""
    statement = select(Device).where(col(Device.groups).is_not(None))
    candidates = session.exec(statement).all()
    devices = [
        device
        for device in candidates
        if device.groups and group_name in device.groups.split(",")
    ]
    # hostname is not unique, so tie-break on id
    return sorted(devices, key=lambda s: (s.hostname, s.id or 0))


def latest_runs_summary(
    session: Session, group_name: str | None = None
) -> list[dict[str, Any]]:
    devices = (
        group_member_devices(session, group_name)
        if group_name
        else session.exec(select(Device)).all()
    )
    summary = []
    for device in devices:
        run = get_latest_run(session, device.id)  # type: ignore[arg-type]
        summary.append(
            {
                "device_id": device.id,
                "hostname": device.hostname,
                "platform": device.platform,
                "latest_run_id": run.id if run else None,
                "passed_count": run.passed_count if run else 0,
                "failed_count": run.failed_count if run else 0,
                "skipped_count": run.skipped_count if run else 0,
                "last_checked": run.created_at if run else None,
            }
        )
    return summary


def delete_runs_by_device_id(session: Session, device_id: int) -> None:
    run_ids = session.exec(
        select(ComplianceRun.id).where(ComplianceRun.device_id == device_id)
    ).all()
    if run_ids:
        session.exec(
            delete(ComplianceResult).where(col(ComplianceResult.run_id).in_(run_ids))
        )
    session.exec(delete(ComplianceRun).where(col(ComplianceRun.device_id) == device_id))
    session.commit()
