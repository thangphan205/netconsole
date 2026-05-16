from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import col, func, or_, select

from app.api.deps import CurrentUser, SessionDep
from app.models import AuditLog, LogPublic, LogsPublic

router = APIRouter()


@router.get("/", response_model=LogsPublic)
def read_logs(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    search: str = "",
    action: str = "",
    severity: str = "",
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

    count = session.exec(
        select(func.count()).select_from(query.subquery())
    ).one()

    logs = session.exec(
        query.order_by(col(AuditLog.timestamp).desc()).offset(skip).limit(limit)
    ).all()

    data = [
        LogPublic(
            id=log.id,
            timestamp=str(log.timestamp),
            severity=log.severity,
            username=log.username,
            client_ip=log.client_ip,
            action=log.action,
            message=log.message,
        )
        for log in logs
    ]
    return LogsPublic(data=data, count=count)
