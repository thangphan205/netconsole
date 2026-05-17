from datetime import UTC, datetime
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, HTTPException
from sqlmodel import col, func, or_, select

from app.api.deps import CurrentUser, SessionDep
from app.core.config import settings
from app.models import AuditLog, LogPublic, LogsPublic

router = APIRouter()


def _fmt_timestamp(ts: Any) -> str:
    try:
        tz = ZoneInfo(settings.TIMEZONE)
    except ZoneInfoNotFoundError:
        tz = ZoneInfo("UTC")
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=UTC)
    return str(ts.astimezone(tz).strftime("%Y-%m-%d %H:%M:%S %Z"))


@router.get("/", response_model=LogsPublic)
def read_logs(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    search: str = "",
    action: str = "",
    severity: str = "",
    from_date: datetime | None = None,
    to_date: datetime | None = None,
) -> Any:
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not enough privileges")

    query = select(AuditLog)
    if search:
        query = query.where(
            or_(
                col(AuditLog.username).contains(search),
                col(AuditLog.message).contains(search),
            )
        )
    if action:
        query = query.where(col(AuditLog.action) == action)
    if severity:
        query = query.where(col(AuditLog.severity) == severity)
    if from_date is not None:
        fd = (
            from_date.replace(tzinfo=None)
            if from_date.tzinfo is not None
            else from_date
        )
        query = query.where(col(AuditLog.timestamp) >= fd)
    if to_date is not None:
        td = to_date.replace(tzinfo=None) if to_date.tzinfo is not None else to_date
        query = query.where(col(AuditLog.timestamp) <= td)

    count = session.exec(select(func.count()).select_from(query.subquery())).one()

    logs = session.exec(
        query.order_by(col(AuditLog.timestamp).desc()).offset(skip).limit(limit)
    ).all()

    data = [
        LogPublic(
            id=log.id,
            timestamp=_fmt_timestamp(log.timestamp),
            severity=log.severity,
            username=log.username,
            client_ip=log.client_ip,
            action=log.action,
            message=log.message,
        )
        for log in logs
    ]
    return LogsPublic(data=data, count=count)
