from typing import Any

from sqlmodel import Session, col, delete, select

from app.models import (
    ComplianceProfile,
    ComplianceProfileUpdate,
    ComplianceResult,
    ComplianceRun,
    Group,
    Switch,
)

PROFILE_FIELDS = (
    "ntp_server",
    "syslog_server",
    "dns_server",
    "password_min_length",
    "exec_timeout_minutes",
)

DEFAULT_GLOBAL_PROFILE = {
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


def effective_profile_for_switch(
    session: Session, switch: Switch
) -> dict[str, str | int | None]:
    """Merge group-profile overrides (sorted by group name, for determinism)
    over the global default profile. A None/unset field in an override does
    not clear an already-merged value."""
    global_profile = get_or_create_global_profile(session)
    effective = {field: getattr(global_profile, field) for field in PROFILE_FIELDS}

    switch_groups = [g.strip() for g in (switch.groups or "").split(",") if g.strip()]
    if not switch_groups:
        return effective

    statement = select(Group).where(col(Group.name).in_(switch_groups))
    matched_groups = sorted(session.exec(statement).all(), key=lambda g: g.name)

    for group in matched_groups:
        assert group.id is not None
        override = get_group_profile(session, group.id)
        if not override:
            continue
        for field in PROFILE_FIELDS:
            value = getattr(override, field)
            if value is not None:
                effective[field] = value

    return effective


def create_run(
    session: Session,
    *,
    switch_id: int,
    platform: str,
    username: str,
    status: str,
    error: str = "",
    profile_snapshot: str = "",
    results: list[dict[str, str]],
) -> ComplianceRun:
    passed = sum(1 for r in results if r["status"] == "pass")
    failed = sum(1 for r in results if r["status"] == "fail")
    skipped = sum(1 for r in results if r["status"] == "skipped")

    run = ComplianceRun(
        switch_id=switch_id,
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
            )
        )
    session.commit()
    return run


def get_run(session: Session, run_id: int) -> ComplianceRun | None:
    return session.get(ComplianceRun, run_id)


def get_run_results(session: Session, run_id: int) -> list[ComplianceResult]:
    statement = (
        select(ComplianceResult)
        .where(ComplianceResult.run_id == run_id)
        .order_by(col(ComplianceResult.id))
    )
    return list(session.exec(statement).all())


def get_latest_run(session: Session, switch_id: int) -> ComplianceRun | None:
    statement = (
        select(ComplianceRun)
        .where(ComplianceRun.switch_id == switch_id)
        .order_by(col(ComplianceRun.id).desc())
        .limit(1)
    )
    return session.exec(statement).first()


def latest_runs_summary(session: Session) -> list[dict[str, Any]]:
    switches = session.exec(select(Switch)).all()
    summary = []
    for switch in switches:
        run = get_latest_run(session, switch.id)  # type: ignore[arg-type]
        summary.append(
            {
                "switch_id": switch.id,
                "hostname": switch.hostname,
                "platform": switch.platform,
                "latest_run_id": run.id if run else None,
                "passed_count": run.passed_count if run else 0,
                "failed_count": run.failed_count if run else 0,
                "skipped_count": run.skipped_count if run else 0,
                "last_checked": run.created_at if run else None,
            }
        )
    return summary


def delete_runs_by_switch_id(session: Session, switch_id: int) -> None:
    run_ids = session.exec(
        select(ComplianceRun.id).where(ComplianceRun.switch_id == switch_id)
    ).all()
    if run_ids:
        session.exec(
            delete(ComplianceResult).where(col(ComplianceResult.run_id).in_(run_ids))
        )
    session.exec(delete(ComplianceRun).where(col(ComplianceRun.switch_id) == switch_id))
    session.commit()
