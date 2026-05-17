from datetime import UTC, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends
from pydantic.networks import EmailStr
from sqlmodel import SQLModel

from app.api.deps import get_current_active_superuser
from app.core.config import settings
from app.models import Message
from app.utils import generate_test_email, send_email

router = APIRouter()


class ServerInfo(SQLModel):
    timezone: str
    current_time: str
    utc_time: str


@router.get(
    "/server-info/",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=ServerInfo,
)
def server_info() -> ServerInfo:
    try:
        tz = ZoneInfo(settings.TIMEZONE)
        tz_name = settings.TIMEZONE
    except ZoneInfoNotFoundError:
        tz = ZoneInfo("UTC")
        tz_name = "UTC (invalid config)"
    now_utc = datetime.now(UTC)
    now_local = now_utc.astimezone(tz)
    return ServerInfo(
        timezone=tz_name,
        current_time=now_local.strftime("%Y-%m-%d %H:%M:%S %Z"),
        utc_time=now_utc.strftime("%Y-%m-%d %H:%M:%S UTC"),
    )


@router.post(
    "/test-email/",
    dependencies=[Depends(get_current_active_superuser)],
    status_code=201,
)
def test_email(email_to: EmailStr) -> Message:
    """
    Test emails.
    """
    email_data = generate_test_email(email_to=email_to)
    send_email(
        email_to=email_to,
        subject=email_data.subject,
        html_content=email_data.html_content,
    )
    return Message(message="Test email sent")
