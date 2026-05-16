from sqlmodel import Session

from app.models import AuditLog


def write_audit_log(
    session: Session,
    username: str,
    action: str,
    *,
    client_ip: str = "",
    message: str = "",
    severity: str = "INFO",
) -> None:
    entry = AuditLog(
        username=username,
        action=action,
        client_ip=client_ip,
        message=message,
        severity=severity,
    )
    session.add(entry)
    session.commit()
