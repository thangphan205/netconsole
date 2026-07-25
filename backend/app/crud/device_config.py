from app.automation.device_config import device_configure
from app.models import DeviceConfigCreate


def create_device_config(
    device_in: DeviceConfigCreate, hostname: str
) -> dict[str, str]:
    return device_configure(
        hostname=hostname,
        commands=device_in.commands,
        command_type=device_in.command_type,
    )
