from collections import defaultdict
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func
from sqlmodel import Session, col, delete, select

from app.automation.compliance_rules import (
    compliance_score,
    get_rule,
    rule_severity,
    severity_weight,
)
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
    not clear an already-merged value.

    `disabled_rules` is the exception: global, group and per-device bypass
    lists are unioned rather than overwritten, so a device-level exemption
    never silently drops one inherited from its group."""
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
    if device.disabled_rules:
        disabled_set.update(
            r.strip() for r in device.disabled_rules.split(",") if r.strip()
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


def count_runs(session: Session, device_id: int) -> int:
    statement = (
        select(func.count())
        .select_from(ComplianceRun)
        .where(col(ComplianceRun.device_id) == device_id)
    )
    return session.exec(statement).one()


def list_runs(
    session: Session, device_id: int, *, skip: int = 0, limit: int = 50
) -> list[ComplianceRun]:
    """A device's compliance runs, newest first — the run history that has
    always been recorded but was never readable over HTTP."""
    statement = (
        select(ComplianceRun)
        .where(ComplianceRun.device_id == device_id)
        .order_by(col(ComplianceRun.id).desc())
        .offset(skip)
        .limit(limit)
    )
    return list(session.exec(statement).all())


def group_member_devices(session: Session, group_name: str) -> list[Device]:
    """Members of a group, in a stable order the aggregate hash depends on.

    The LIKE narrows the scan in SQL; membership is still confirmed in Python
    because `groups` is a comma-separated string, so a LIKE alone would also
    match a group whose name is a substring of another's.
    """
    statement = select(Device).where(
        col(Device.groups).is_not(None),
        col(Device.groups).contains(group_name, autoescape=True),
    )
    candidates = session.exec(statement).all()
    devices = [
        device
        for device in candidates
        if device.groups and group_name in device.groups.split(",")
    ]
    # hostname is not unique, so tie-break on id
    return sorted(devices, key=lambda s: (s.hostname, s.id or 0))


LatestRow = tuple[Device, ComplianceRun | None]


def _latest_rows(
    session: Session,
    group_name: str | None = None,
    *,
    q: str | None = None,
    status: str | None = None,
    rule_id: str | None = None,
    skip: int = 0,
    limit: int | None = None,
) -> tuple[list[LatestRow], int]:
    """Every device paired with its most recent run (None if never checked).

    One query for the pairing — a correlated `max(id)` subquery rather than a
    per-device lookup — plus one for the total count.
    """
    latest = (
        select(
            col(ComplianceRun.device_id).label("device_id"),
            func.max(col(ComplianceRun.id)).label("run_id"),
        )
        .group_by(col(ComplianceRun.device_id))
        .subquery()
    )
    statement = (
        select(Device, ComplianceRun)
        .outerjoin(latest, latest.c.device_id == col(Device.id))
        .outerjoin(ComplianceRun, col(ComplianceRun.id) == latest.c.run_id)
    )

    if group_name:
        member_ids = [d.id for d in group_member_devices(session, group_name)]
        if not member_ids:
            return [], 0
        statement = statement.where(col(Device.id).in_(member_ids))
    if q:
        statement = statement.where(col(Device.hostname).contains(q, autoescape=True))
    if status == "never":
        statement = statement.where(latest.c.run_id.is_(None))
    elif status == "failing":
        statement = statement.where(col(ComplianceRun.failed_count) > 0)
    elif status == "compliant":
        statement = statement.where(
            latest.c.run_id.is_not(None), col(ComplianceRun.failed_count) == 0
        )
    if rule_id:
        # Devices whose *latest* run has this rule failing — the drill-down
        # from "rules failing on the most devices".
        failing_runs = select(col(ComplianceResult.run_id)).where(
            col(ComplianceResult.rule_id) == rule_id,
            col(ComplianceResult.status) == "fail",
        )
        statement = statement.where(latest.c.run_id.in_(failing_runs))

    count = session.exec(select(func.count()).select_from(statement.subquery())).one()

    # hostname is not unique, so tie-break on id to keep pagination stable
    statement = statement.order_by(col(Device.hostname), col(Device.id))
    if skip:
        statement = statement.offset(skip)
    if limit is not None:
        statement = statement.limit(limit)
    return list(session.exec(statement).all()), count


def _results_by_run(
    session: Session, run_ids: list[int]
) -> dict[int, list[ComplianceResult]]:
    """All results for the given runs in a single query, grouped by run id."""
    grouped: dict[int, list[ComplianceResult]] = defaultdict(list)
    if not run_ids:
        return grouped
    statement = (
        select(ComplianceResult)
        .where(col(ComplianceResult.run_id).in_(run_ids))
        .order_by(col(ComplianceResult.id))
    )
    for result in session.exec(statement).all():
        grouped[result.run_id].append(result)
    return grouped


def _summarize(row: LatestRow, results: list[ComplianceResult]) -> dict[str, Any]:
    device, run = row
    failed_by_severity = {"high": 0, "medium": 0, "low": 0}
    remediable_failed = 0
    for result in results:
        if result.status != "fail":
            continue
        severity = rule_severity(result.rule_id)
        if severity in failed_by_severity:
            failed_by_severity[severity] += 1
        if result.remediation_commands:
            remediable_failed += 1

    return {
        "device_id": device.id,
        "hostname": device.hostname,
        "platform": device.platform,
        "latest_run_id": run.id if run else None,
        "passed_count": run.passed_count if run else 0,
        "failed_count": run.failed_count if run else 0,
        "skipped_count": run.skipped_count if run else 0,
        "last_checked": run.created_at if run else None,
        "failed_high": failed_by_severity["high"],
        "failed_medium": failed_by_severity["medium"],
        "failed_low": failed_by_severity["low"],
        "remediable_failed_count": remediable_failed,
        "score": compliance_score((r.rule_id, r.status) for r in results),
    }


def latest_runs_summary(
    session: Session,
    group_name: str | None = None,
    *,
    q: str | None = None,
    status: str | None = None,
    rule_id: str | None = None,
    skip: int = 0,
    limit: int | None = None,
) -> tuple[list[dict[str, Any]], int]:
    rows, count = _latest_rows(
        session,
        group_name,
        q=q,
        status=status,
        rule_id=rule_id,
        skip=skip,
        limit=limit,
    )
    results = _results_by_run(session, [run.id for _, run in rows if run and run.id])
    summary = [
        _summarize(row, results.get(row[1].id, []) if row[1] and row[1].id else [])
        for row in rows
    ]
    return summary, count


def fleet_overview(
    session: Session, group_name: str | None = None
) -> dict[str, list[Any] | int | float | datetime | dict[str, int] | None]:
    """Fleet-wide rollup over every device's latest run.

    Deliberately unpaginated — the whole point is to aggregate the estate, and
    it reuses the same two queries the summary does.
    """
    rows, total_devices = _latest_rows(session, group_name)
    run_ids = [run.id for _, run in rows if run and run.id]
    results_by_run = _results_by_run(session, run_ids)

    checked = failing = compliant = 0
    passed_total = failed_total = skipped_total = 0
    severity_breakdown = {"high": 0, "medium": 0, "low": 0}
    last_checked: datetime | None = None
    # rule_id -> [failed_devices, evaluated_devices]
    rule_tally: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    # (framework, control) -> [passed, failed]
    framework_tally: dict[tuple[str, str], list[int]] = defaultdict(lambda: [0, 0])
    weighted_earned = weighted_total = 0

    for _, run in rows:
        if not run or not run.id:
            continue
        checked += 1
        passed_total += run.passed_count
        failed_total += run.failed_count
        skipped_total += run.skipped_count
        if run.failed_count > 0:
            failing += 1
        else:
            compliant += 1
        if last_checked is None or run.created_at > last_checked:
            last_checked = run.created_at

        for result in results_by_run.get(run.id, []):
            if result.status not in ("pass", "fail"):
                continue
            rule = get_rule(result.rule_id)
            weight = severity_weight(rule.severity if rule else "")
            weighted_total += weight
            tally = rule_tally[result.rule_id]
            tally[1] += 1
            if result.status == "pass":
                weighted_earned += weight
            else:
                tally[0] += 1
                if rule and rule.severity in severity_breakdown:
                    severity_breakdown[rule.severity] += 1
            if not rule:
                continue
            for framework, controls in (
                ("pci_dss", rule.pci_dss),
                ("iso27001", rule.iso27001),
            ):
                for control in controls:
                    framework_tally[(framework, control)][
                        0 if result.status == "pass" else 1
                    ] += 1

    def rule_stat(rule_id: str, failed_devices: int, evaluated: int) -> dict[str, Any]:
        rule = get_rule(rule_id)
        return {
            "rule_id": rule_id,
            "title": rule.title if rule else rule_id,
            "severity": rule.severity if rule else "",
            "failed_devices": failed_devices,
            "total_devices": evaluated,
        }

    top_failing = sorted(
        (
            rule_stat(rule_id, failed_devices, evaluated)
            for rule_id, (failed_devices, evaluated) in rule_tally.items()
            if failed_devices
        ),
        key=lambda item: (
            -severity_weight(str(item["severity"])) * int(item["failed_devices"]),
            str(item["rule_id"]),
        ),
    )

    return {
        "total_devices": total_devices,
        "checked_devices": checked,
        "never_checked": total_devices - checked,
        "compliant_devices": compliant,
        "failing_devices": failing,
        "passed_total": passed_total,
        "failed_total": failed_total,
        "skipped_total": skipped_total,
        "score": (
            round(100 * weighted_earned / weighted_total, 1) if weighted_total else None
        ),
        "severity_breakdown": severity_breakdown,
        "top_failing_rules": top_failing,
        "framework_stats": [
            {
                "framework": framework,
                "control": control,
                "passed": passed,
                "failed": failed,
            }
            for (framework, control), (passed, failed) in sorted(
                framework_tally.items()
            )
        ],
        "last_checked": last_checked,
    }


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
