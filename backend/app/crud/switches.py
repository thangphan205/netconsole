from typing import Any
from sqlmodel import Session, select, func

from app.models import Switch, SwitchCreate, SwitchUpdate
from app.automation.switches import get_metadata, show_interfaces_status
from app.crud.create_nornir import create_hosts
from app.crud.interfaces import update_interface_metadata


def get_switches(
    session: Session, skip: int, limit: int, ipaddress: str, hostname: str
):

    statement = select(Switch)
    if ipaddress:
        statement.where(Switch.ipaddress == ipaddress)
    if hostname:
        statement.where(Switch.hostname == hostname)
    switches = session.exec(statement.offset(skip).limit(limit)).all()
    return switches


def get_switch_by_id(session: Session, id: int):

    switch = session.get(Switch, id)
    return switch


def get_switches_count(session: Session, skip: int, limit: int):

    count_statement = select(func.count()).select_from(Switch)
    count = session.exec(count_statement).one()
    return count


def create_switch(session: Session, switch_in: SwitchCreate) -> Switch:

    switch = Switch.model_validate(switch_in)
    session.add(switch)
    session.commit()
    session.refresh(switch)
    # Generate new hosts.yaml file
    statement = select(Switch)
    switches_db = session.exec(statement).all()
    create_hosts(switches_db)
    return switch


def update_switch(
    *, session: Session, switch_db: Switch, switch_in: SwitchUpdate
) -> Any:
    """
    Update an switch.
    """

    update_dict = switch_in.__dict__
    switch_db.sqlmodel_update(update_dict)
    session.add(switch_db)
    session.commit()
    session.refresh(switch_db)

    # Generate new hosts.yaml file
    statement = select(Switch)
    switches_db = session.exec(statement).all()
    create_hosts(switches_db)
    return switch_db


def update_switch_metadata(*, session: Session, switch_db: Switch) -> Any:
    """
    Update an switch.
    """

    facts = get_metadata(hostname=switch_db.hostname)
    switch_db.model = facts[switch_db.hostname]["get_facts"]["model"]
    switch_db.os_version = facts[switch_db.hostname]["get_facts"]["os_version"]
    switch_db.serial_number = facts[switch_db.hostname]["get_facts"]["serial_number"]
    switch_db.vendor = facts[switch_db.hostname]["get_facts"]["vendor"]

    session.add(switch_db)
    session.commit()
    session.refresh(switch_db)

    # Update interfaces:
    update_interface_metadata(
        session=session,
        interfaces_in=show_interfaces_status(hostname=switch_db.hostname),
        switch_id=switch_db.id,
    )

    return switch_db


def delete_switch(session: Session, switch_db: Switch):

    session.delete(switch_db)
    session.commit()
    return True
