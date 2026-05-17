from datetime import datetime
from typing import Any

from sqlalchemy.sql.expression import or_
from sqlmodel import Session, asc, func, select

from app.models import IpInterface, IpInterfaceCreate, IpInterfaceUpdate, Switch


def get_ip_interfaces(
    session: Session,
    skip: int,
    limit: int,
    interface: str,
    ipv4: str,
    switch_id: int,
    search: str = "",
    since: datetime | None = None,
):
    if since is not None:
        since = since.replace(tzinfo=None)

    statement = (
        select(IpInterface, Switch)
        .join(Switch)
        .filter(
            or_(
                IpInterface.ipv4.contains(search),
                IpInterface.interface.contains(search),
            )
        )
    ).order_by(asc(IpInterface.ipv4))
    if interface:
        statement = statement.where(IpInterface.interface.like(f"%{interface}%"))
    if ipv4:
        statement = statement.where(IpInterface.ipv4 == ipv4)
    if switch_id > 0:
        statement = statement.where(IpInterface.switch_id == switch_id)
    if since is not None:
        statement = statement.where(IpInterface.created_at >= since)
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
    since: datetime | None = None,
):
    if since is not None:
        since = since.replace(tzinfo=None)

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
            IpInterface.interface.like(f"%{interface}%")
        )
    if ipv4:
        count_statement = count_statement.where(IpInterface.ipv4 == ipv4)
    if switch_id > 0:
        count_statement = count_statement.where(IpInterface.switch_id == switch_id)
    if since is not None:
        count_statement = count_statement.where(IpInterface.created_at >= since)
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
    ip_interface_in: IpInterfaceUpdate,
) -> Any:
    """
    Update an ip_interface.
    """

    update_dict = ip_interface_in.model_dump(exclude_unset=True)
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
    # Build deduplicated map of existing records keyed by interface name.
    # If duplicates exist (from a previous bug), keep the oldest and delete extras.
    existing_all = session.exec(
        select(IpInterface).where(IpInterface.switch_id == switch_id)
    ).all()
    by_interface: dict[str, IpInterface] = {}
    for record in existing_all:
        if record.interface in by_interface:
            # Keep oldest record to preserve original created_at; delete the duplicate
            if record.created_at < by_interface[record.interface].created_at:
                session.delete(by_interface[record.interface])
                by_interface[record.interface] = record
            else:
                session.delete(record)
        else:
            by_interface[record.interface] = record
    session.flush()

    seen_interfaces: set[str] = set()

    for interface, ip_interface_info in ip_interfaces_in.items():
        seen_interfaces.add(interface)
        list_ipv4 = []

        for family, family_info in ip_interface_info.items():
            if family == "ipv4":
                for ip, prefix_info in family_info.items():
                    list_ipv4.append("{}/{}".format(ip, prefix_info["prefix_length"]))

        payload = {
            "switch_id": switch_id,
            "interface": interface,
            "ipv4": ",".join(list_ipv4),
            "ipv6": "",
        }

        if interface in by_interface:
            update_ip_interface(
                session=session,
                ip_interface_db=by_interface[interface],
                ip_interface_in=IpInterfaceUpdate(**payload),
            )
        else:
            create_ip_interface(
                session=session,
                ip_interface_in=IpInterfaceCreate(**payload),
            )

    # Delete stale records no longer on device
    for interface, record in by_interface.items():
        if interface not in seen_interfaces:
            session.delete(record)
    session.commit()

    return True
