from app.automation.group_config import group_configure
from app.models import GroupConfigCreate


def create_group_config(group_in: GroupConfigCreate):
    return group_configure(
        group_name=group_in.group_name,
        commands=group_in.commands,
        command_type=group_in.command_type,
    )
