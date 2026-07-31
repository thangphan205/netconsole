import re

from sqlmodel import Session

from app.models import AuditLog

_SENSITIVE_TOKEN = re.compile(
    r"(password|secret|community|pre-shared-key|preshared-key|key)(\s+)\S+",
    re.IGNORECASE,
)


def redact_sensitive(text: str) -> str:
    """Mask credential-like values (password/secret/community/key lines) before logging."""
    return _SENSITIVE_TOKEN.sub(lambda m: f"{m.group(1)}{m.group(2)}[REDACTED]", text)


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
