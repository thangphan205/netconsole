from typing import Any
from sqlmodel import Session, select, func

from app.models import Arp, ArpCreate, ArpUpdate, Switch
from datetime import datetime


def get_arps(
    session: Session,
    skip: int,
    limit: int,
    ip: str,
    mac: str,
    interface: str,
    switch_id: int,
):
    statement = None
    if switch_id > 0:
        statement = select(Arp)
    else:
        statement = select(Arp, Switch).join(Switch)
    if ip:
        statement = statement.where(Arp.ip == ip)
    if mac:
        statement = statement.where(Arp.mac == mac)
    if interface:
        statement = statement.where(Arp.interface == interface)
    if switch_id > 0:
        statement = statement.where(Arp.switch_id == switch_id)
    arps = session.exec(statement.offset(skip).limit(limit)).all()
    if switch_id > 0:
        return arps
    else:
        list_arps = []
        for arp_db, switch_db in arps:
            arp_info = arp_db.__dict__
            arp_info["switch_hostname"] = switch_db.hostname
            list_arps.append(arp_info)
        return list_arps


def get_arp_by_id(session: Session, id: int):

    arp = session.get(Arp, id)
    return arp


def get_arp_by_ip(
    session: Session,
    ip: str,
    mac: str,
    interface: str,
    switch_id: int,
) -> Arp | None:

    statement = select(Arp).where(
        Arp.ip == ip,
        Arp.switch_id == switch_id,
        Arp.interface == interface,
        Arp.mac == mac,
    )
    arp_db = session.exec(statement).first()
    return arp_db


def get_arps_count(
    session: Session,
    ip: str,
    mac: str,
    interface: str,
    switch_id: int,
    skip: int,
    limit: int,
):

    count_statement = select(func.count()).select_from(Arp)
    if ip:
        count_statement = count_statement.where(Arp.ip == ip)
    if mac:
        count_statement = count_statement.where(Arp.mac == mac)
    if interface:
        count_statement = count_statement.where(Arp.interface == interface)
    if switch_id > 0:
        count_statement = count_statement.where(Arp.switch_id == switch_id)
    count = session.exec(count_statement).one()
    return count


def create_arp(session: Session, arp_in: ArpCreate) -> Arp:

    arp = Arp.model_validate(arp_in)
    session.add(arp)
    session.commit()
    session.refresh(arp)

    return arp


def update_arp(*, session: Session, arp_db: Arp, arp_in: ArpUpdate) -> Any:
    """
    Update an arp.
    """

    update_dict = arp_in.__dict__
    update_dict["updated_at"] = datetime.now()
    arp_db.sqlmodel_update(update_dict)
    session.add(arp_db)
    session.commit()
    session.refresh(arp_db)

    return arp_db


def delete_arp(session: Session, arp_db: Arp):

    session.delete(arp_db)
    session.commit()
    return True


def delete_arp_by_switch_id(session: Session, switch_id: int):
    arps = session.exec(select(Arp).where(Arp.switch_id == switch_id)).all()
    for arp in arps:
        session.delete(arp)
        session.commit()
    return True


def update_arp_running(session: Session, arps_in: dict, switch_id: int) -> Any:
    for arp_in in arps_in:
        arp_in["mac"] = arp_in["mac"].lower().replace(":", "")
        arp_in["switch_id"] = switch_id
        arp_in["age"] = int(arp_in["age"])
        arp_db = get_arp_by_ip(
            session=session,
            ip=arp_in["ip"],
            mac=arp_in["mac"],
            interface=arp_in["interface"],
            switch_id=switch_id,
        )
        if arp_db:
            update_arp(
                session=session,
                arp_db=arp_db,
                arp_in=ArpUpdate(**arp_in),
            )
        else:
            create_arp(session=session, arp_in=ArpCreate(**arp_in))
    return True
