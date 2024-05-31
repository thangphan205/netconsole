from typing import Any
from sqlmodel import Session, select, func

from app.models import (
    Interface,
    InterfaceCreate,
    InterfaceUpdate,
    InterfacesPublic,
)
from app.automation.interfaces import configure_interface, show_run_interface


def get_interfaces(
    session: Session, port: str, switch_id: int, skip: int = 0, limit: int = 0
):
    statement = select(Interface).where(Interface.switch_id == switch_id)
    if port:
        statement = statement.where(Interface.port == port)
    interfaces = session.exec(statement.offset(skip).limit(limit)).all()
    return interfaces


def get_interface(session: Session, port: str, switch_id: int):

    statement = (
        select(Interface)
        .where(Interface.port == port)
        .where(Interface.switch_id == switch_id)
    )
    interfaces = session.exec(statement.order_by(Interface.port)).all()
    return interfaces


def get_interface_running(session: Session, hostname: str, port: str):
    interface_info = show_run_interface(hostname=hostname, port=port)
    return interface_info


def get_interfaces_count(
    session: Session,
    switch_id: int,
    skip: int = 0,
    limit: int = 0,
):

    count_statement = (
        select(func.count())
        .select_from(Interface)
        .where(Interface.switch_id == switch_id)
    )
    count = session.exec(count_statement).one()
    return count


def create_interface(session: Session, interface_in: InterfaceCreate) -> Interface:

    interface = Interface.model_validate(interface_in)
    session.add(interface)
    session.commit()
    session.refresh(interface)

    return interface


def update_interface(
    *,
    session: Session,
    interface_db: Interface,
    interface_in: InterfaceUpdate,
    update_running_config: int = 1
) -> Any:
    """
    Update an interface.
    """
    # update local database
    update_dict = interface_in.__dict__
    update_dict["allowed_vlan"] = update_dict["allowed_vlan_add"]
    interface_db.sqlmodel_update(update_dict)
    session.add(interface_db)
    session.commit()
    session.refresh(interface_db)
    # update running config
    if update_running_config:
        try:
            from .switches import get_switch_by_id
        except ImportError:
            get_switch_by_id = None
        switch = get_switch_by_id(session=session, id=update_dict["switch_id"])

        configure_interface(
            hostname=switch.__dict__["hostname"], interface_info=update_dict
        )

    return interface_db


def update_interface_metadata(
    *, session: Session, interfaces_in: InterfacesPublic, switch_id: int
) -> Any:
    """
    Update interfaces from running config
    {
        'description': '--',
        'port': 'Eth1/50',
        'status': 'up',
        'vlan': 'trunk',
        'duplex': 'full',
        'speed': '10 Mbps',
        'type': '10Gbase-SR'
    }
    """
    for interface_info in interfaces_in:
        interface_dict = {
            "port": interface_info["port"],
            "description": interface_info["description"],
            "status": interface_info["status"],
            "vlan": interface_info["vlan"],
            "duplex": interface_info["duplex"],
            "speed": interface_info["speed"],
            "type": interface_info["type"],
            "mode": interface_info["mode"],
            "native_vlan": interface_info["native_vlan"],
            "allowed_vlan": interface_info["allowed_vlan"],
            "allowed_vlan_add": interface_info["allowed_vlan_add"],
            "switch_id": switch_id,
        }
        interface_db = get_interface(
            session=session, port=interface_info["port"], switch_id=switch_id
        )

        if interface_db:
            update_interface(
                session=session,
                interface_db=interface_db[0],
                interface_in=InterfaceUpdate(**interface_dict),
                update_running_config=0,
            )
        else:
            create_interface(
                session=session, interface_in=InterfaceCreate(**interface_dict)
            )

    return True


def delete_interface(session: Session, interface_db: Interface):

    session.delete(interface_db)
    session.commit()
    return True
