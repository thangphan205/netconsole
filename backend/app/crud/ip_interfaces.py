from typing import Any
from sqlmodel import Session, select, func
from sqlalchemy.sql.expression import or_

from app.models import IpInterface, IpInterfaceCreate, IpInterfaceUpdate, Switch
from datetime import datetime


def get_ip_interfaces(
    session: Session,
    skip: int,
    limit: int,
    interface: str,
    ipv4: str,
    switch_id: int,
    search: str = "",
):

    statement = (
        select(IpInterface, Switch)
        .join(Switch)
        .filter(
            or_(
                IpInterface.ipv4.contains(search),
                IpInterface.interface.contains(search),
            )
        )
    )
    if interface:
        statement = statement.where(
            IpInterface.interface.like("%{}%".format(interface))
        )
    if ipv4:
        statement = statement.where(IpInterface.ipv4 == ipv4)
    if switch_id > 0:
        statement = statement.where(IpInterface.switch_id == switch_id)
    ip_interfaces = session.exec(statement.offset(skip).limit(limit)).all()
    list_ip_interfaces = []
    for interface_db, switch_db in ip_interfaces:
        ip_interface_info = interface_db.__dict__
        ip_interface_info["switch_hostname"] = switch_db.hostname
        list_ip_interfaces.append(ip_interface_info)
    return list_ip_interfaces


def get_ip_interface_by_id(session: Session, id: int):

    ip_interface = session.get(IpInterface, id)
    return ip_interface


def get_ip_interface_by_ipv4(
    session: Session,
    interface: str,
    ipv4: str,
    switch_id: int,
) -> IpInterface | None:

    statement = select(IpInterface).where(
        IpInterface.ipv4 == ipv4,
        IpInterface.switch_id == switch_id,
        IpInterface.interface == interface,
    )
    ip_interface_db = session.exec(statement).first()
    return ip_interface_db


def get_ip_interfaces_count(
    session: Session,
    interface: str,
    ipv4: str,
    switch_id: int,
    skip: int,
    limit: int,
    search: str = "",
):

    count_statement = (
        select(func.count())
        .select_from(IpInterface)
        .filter(
            or_(
                IpInterface.ipv4.contains(search),
                IpInterface.interface.contains(search),
            )
        )
    )
    if interface:
        count_statement = count_statement.where(
            IpInterface.interface.like("%{}%".format(interface))
        )
    if ipv4:
        count_statement = count_statement.where(IpInterface.ipv4 == ipv4)
    if switch_id > 0:
        count_statement = count_statement.where(IpInterface.switch_id == switch_id)
    count = session.exec(count_statement).one()
    return count


def create_ip_interface(
    session: Session, ip_interface_in: IpInterfaceCreate
) -> IpInterface:

    ip_interface = IpInterface.model_validate(ip_interface_in)
    session.add(ip_interface)
    session.commit()
    session.refresh(ip_interface)

    return ip_interface


def update_ip_interface(
    *,
    session: Session,
    ip_interface_db: IpInterface,
    ip_interface_in: IpInterfaceUpdate
) -> Any:
    """
    Update an ip_interface.
    """

    update_dict = ip_interface_in.__dict__
    update_dict["updated_at"] = datetime.now()
    ip_interface_db.sqlmodel_update(update_dict)
    session.add(ip_interface_db)
    session.commit()
    session.refresh(ip_interface_db)

    return ip_interface_db


def delete_ip_interface(session: Session, ip_interface_db: IpInterface):

    session.delete(ip_interface_db)
    session.commit()
    return True


def delete_ip_interface_by_switch_id(session: Session, switch_id: int):
    ip_interfaces = session.exec(
        select(IpInterface).where(IpInterface.switch_id == switch_id)
    ).all()
    for ip_interface in ip_interfaces:
        session.delete(ip_interface)
        session.commit()
    return True


def update_ip_interface_running(
    session: Session, ip_interfaces_in: dict, switch_id: int
) -> Any:
    for interface, ip_interface_info in ip_interfaces_in.items():
        ip_interface_create = {"switch_id": switch_id, "interface": interface}
        list_ipv4 = []

        for ipv4, ipv4_info in ip_interface_info.items():
            if ipv4 == "ipv4":
                for ip, prefix_length in ipv4_info.items():
                    list_ipv4.append("{}/{}".format(ip, prefix_length["prefix_length"]))
            else:
                # don't process ipv6
                continue
        ip_interface_create["ipv4"] = ",".join(list_ipv4)
        ip_interface_create["ipv6"] = ""

        ip_interface_db = get_ip_interface_by_ipv4(
            session=session,
            interface=ip_interface_create["interface"],
            ipv4=ip_interface_create["ipv4"],
            switch_id=switch_id,
        )
        if ip_interface_db:
            update_ip_interface(
                session=session,
                ip_interface_db=ip_interface_db,
                ip_interface_in=IpInterfaceUpdate(**ip_interface_create),
            )
        else:
            create_ip_interface(
                session=session,
                ip_interface_in=IpInterfaceCreate(**ip_interface_create),
            )
    return True
