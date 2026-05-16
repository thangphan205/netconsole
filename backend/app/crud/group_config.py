from sqlmodel import Session

from app.automation.group_config import group_configure
from app.models import GroupConfigCreate


def create_group_config(session: Session, group_in: GroupConfigCreate):

    result = group_configure(
        group_name=group_in.group_name,
        commands=group_in.commands,
        command_type=group_in.command_type,
    )
    return result
