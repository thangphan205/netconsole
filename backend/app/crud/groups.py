from typing import Any
from sqlmodel import Session, select, func

from app.models import Group, GroupCreate, GroupUpdate
from datetime import datetime
from app.crud.create_nornir import create_groups


def get_groups(
    session: Session,
    skip: int,
    limit: int,
    ip: str,
    mac: str,
    interface: str,
    switch_id: int,
):

    statement = select(Group)
    if ip:
        statement = statement.where(Group.ip == ip)
    if mac:
        statement = statement.where(Group.mac == mac)
    if interface:
        statement = statement.where(Group.interface == interface)
    if switch_id > 0:
        statement = statement.where(Group.switch_id == switch_id)
    groups = session.exec(statement.offset(skip).limit(limit)).all()
    return groups


def get_group_by_id(session: Session, id: int):

    group = session.get(Group, id)
    return group


def get_group_by_name(session: Session, name: str):

    statement = select(Group).where(Group.name == name)
    group = session.exec(statement).all()
    return group


def get_groups_count(
    session: Session,
    ip: str,
    mac: str,
    interface: str,
    switch_id: int,
    skip: int,
    limit: int,
):

    count_statement = select(func.count()).select_from(Group)
    if ip:
        count_statement = count_statement.where(Group.ip == ip)
    if mac:
        count_statement = count_statement.where(Group.mac == mac)
    if interface:
        count_statement = count_statement.where(Group.interface == interface)
    if switch_id > 0:
        count_statement = count_statement.where(Group.switch_id == switch_id)
    count = session.exec(count_statement).one()
    return count


def create_group(session: Session, group_in: GroupCreate) -> Group:

    group = Group.model_validate(group_in)
    session.add(group)
    session.commit()
    session.refresh(group)

    groups_db = session.exec(select(Group)).all()
    create_groups(groups_db=groups_db)
    return group


def update_group(*, session: Session, group_db: Group, group_in: GroupUpdate) -> Any:
    """
    Update an group.
    """

    update_dict = group_in.__dict__
    update_dict["updated_at"] = datetime.now()
    group_db.sqlmodel_update(update_dict)
    session.add(group_db)
    session.commit()
    session.refresh(group_db)

    return group_db


def delete_group(session: Session, group_db: Group):

    session.delete(group_db)
    session.commit()
    return True


def update_group_running(session: Session, groups_in: dict, switch_id: int) -> Any:
    for group_in in groups_in:
        group_in["mac"] = group_in["mac"].lower().replace(":", "")
        group_in["switch_id"] = switch_id
        group_db = get_groups(
            session=session,
            ip=group_in["ip"],
            mac=group_in["mac"],
            interface=group_in["interface"],
            switch_id=switch_id,
            limit=100,
            skip=0,
        )
        if group_db:
            update_group(
                session=session,
                group_db=group_db[0],
                group_in=GroupUpdate(**group_in),
            )
        else:
            create_group(session=session, group_in=GroupCreate(**group_in))
    return True
