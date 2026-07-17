from app.automation.switch_config import switch_configure
from app.models import SwitchConfigCreate


def create_switch_config(switch_in: SwitchConfigCreate, hostname: str):
    return switch_configure(
        hostname=hostname,
        commands=switch_in.commands,
        command_type=switch_in.command_type,
    )
