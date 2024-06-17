from datetime import datetime
from typing import Any
from sqlmodel import Session, select, func
from sqlalchemy.sql.expression import or_
from app.models import Switch, SwitchCreate, SwitchUpdate
from app.automation.switches import (
    get_metadata,
    show_interfaces_status,
    get_metadata_all,
)
from app.crud.create_nornir import create_hosts
from app.crud.interfaces import update_interface_metadata
from app.crud.mac_addresses import update_mac_address_running
from app.crud.arps import update_arp_running
from app.crud.ip_interfaces import update_ip_interface_running


def get_switches(
    session: Session,
    skip: int,
    limit: int,
    ipaddress: str,
    hostname: str,
    search: str = "",
):

    statement = select(Switch)
    if ipaddress:
        statement = statement.where(Switch.ipaddress == ipaddress)
    if hostname:
        statement = statement.where(Switch.hostname == hostname)
    if search:
        statement = statement.filter(
            or_(
                Switch.hostname.contains(search),
                Switch.ipaddress.contains(search),
                Switch.groups.contains(search),
                Switch.platform.contains(search),
                Switch.device_type.contains(search),
                Switch.os_version.contains(search),
                Switch.serial_number.contains(search),
                Switch.description.contains(search),
            )
        )
    switches = session.exec(statement.offset(skip).limit(limit)).all()
    return switches


def get_switch_by_id(session: Session, id: int):

    switch = session.get(Switch, id)
    return switch


def get_switch_by_name(session: Session, hostname: str):
    statement = select(Switch).where(Switch.hostname == hostname)
    switches = session.exec(statement).all()
    return switches


def get_switches_count(session: Session, skip: int, limit: int, search: str = ""):

    count_statement = select(func.count()).select_from(Switch)
    if search:
        count_statement = count_statement.filter(
            or_(
                Switch.hostname.contains(search),
                Switch.ipaddress.contains(search),
                Switch.groups.contains(search),
                Switch.platform.contains(search),
                Switch.device_type.contains(search),
                Switch.os_version.contains(search),
                Switch.serial_number.contains(search),
                Switch.description.contains(search),
            )
        )
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
    update_dict["updated_at"] = datetime.now()
    switch_db.sqlmodel_update(update_dict)
    session.add(switch_db)
    session.commit()
    session.refresh(switch_db)

    # Generate new hosts.yaml file
    statement = select(Switch)
    switches_db = session.exec(statement).all()
    create_hosts(switches_db)
    return switch_db


def update_switch_delete_group(*, session: Session, group_name: str) -> Any:
    """
    Update an switch.
    """

    # Generate new hosts.yaml file
    statement = select(Switch)
    switches_db = session.exec(statement).all()
    switch_change_groups = []
    for switch_db in switches_db:
        if group_name in switch_db.groups:
            switch_change_groups.append(switch_db.id)
    for switch_id in switch_change_groups:
        switch_db = get_switch_by_id(session=session, id=switch_id)
        list_group = switch_db.groups.split(",")
        list_group.remove(group_name)
        if list_group is not None:
            switch_db.groups = ",".join(list_group)
        else:
            switch_db.groups = ""
        session.add(switch_db)
        session.commit()
        session.refresh(switch_db)
    statement = select(Switch)
    switches_db = session.exec(statement).all()
    create_hosts(switches_db)
    return True


def update_switch_metadata(*, session: Session, switch_db: Switch) -> Any:
    """
    Update an switch.
    """

    facts = get_metadata(switch=switch_db)
    if facts:
        switch_db.model = facts[switch_db.hostname]["get_facts"]["model"]
        switch_db.os_version = facts[switch_db.hostname]["get_facts"]["os_version"]
        switch_db.serial_number = facts[switch_db.hostname]["get_facts"][
            "serial_number"
        ]
        switch_db.vendor = facts[switch_db.hostname]["get_facts"]["vendor"]
        switch_db.updated_at = datetime.now()
        session.add(switch_db)
        session.commit()
        session.refresh(switch_db)
        update_mac_address_running(
            session=session,
            mac_addresses_in=facts[switch_db.hostname]["get_mac_address_table"],
            switch_id=switch_db.id,
        )
        update_arp_running(
            session=session,
            arps_in=facts[switch_db.hostname]["get_arp_table"],
            switch_id=switch_db.id,
        )
        update_ip_interface_running(
            session=session,
            ip_interfaces_in=facts[switch_db.hostname]["get_interfaces_ip"],
            switch_id=switch_db.id,
        )
        # Update interfaces:
        if switch_db.platform == "junos":
            update_interface_metadata(
                session=session,
                interfaces_in=show_interfaces_status(switch=switch_db),
                interfaces_status=facts[switch_db.hostname]["get_interfaces"],
                switch=switch_db,
            )
        else:
            update_interface_metadata(
                session=session,
                interfaces_in=show_interfaces_status(switch=switch_db),
                interfaces_status={},
                switch=switch_db,
            )
        return switch_db
    return False


def delete_switch(session: Session, switch_db: Switch):

    session.delete(switch_db)
    session.commit()
    return True


def update_switch_metadata_all(*, session: Session, switch_db: Switch) -> Any:
    """
    Update an switch.
    """

    facts = get_metadata_all(switch=switch_db)
    if facts:
        switches_db = get_switches(
            session=session, skip=0, limit=500, ipaddress="", hostname=""
        )
        for switch_db in switches_db:
            if switch_db.hostname in facts:
                switch_db.model = facts[switch_db.hostname]["get_facts"]["model"]
                switch_db.os_version = facts[switch_db.hostname]["get_facts"][
                    "os_version"
                ]
                switch_db.serial_number = facts[switch_db.hostname]["get_facts"][
                    "serial_number"
                ]
                switch_db.vendor = facts[switch_db.hostname]["get_facts"]["vendor"]
                switch_db.updated_at = datetime.now()
                session.add(switch_db)
                session.commit()
                session.refresh(switch_db)
                update_mac_address_running(
                    session=session,
                    mac_addresses_in=facts[switch_db.hostname]["get_mac_address_table"],
                    switch_id=switch_db.id,
                )
                update_arp_running(
                    session=session,
                    arps_in=facts[switch_db.hostname]["get_arp_table"],
                    switch_id=switch_db.id,
                )
                update_ip_interface_running(
                    session=session,
                    ip_interfaces_in=facts[switch_db.hostname]["get_interfaces_ip"],
                    switch_id=switch_db.id,
                )
                # Update interfaces:
                if switch_db.platform == "junos":
                    update_interface_metadata(
                        session=session,
                        interfaces_in=show_interfaces_status(switch=switch_db),
                        interfaces_status=facts[switch_db.hostname]["get_interfaces"],
                        switch=switch_db,
                    )
                else:
                    update_interface_metadata(
                        session=session,
                        interfaces_in=show_interfaces_status(switch=switch_db),
                        interfaces_status={},
                        switch=switch_db,
                    )
    return False
