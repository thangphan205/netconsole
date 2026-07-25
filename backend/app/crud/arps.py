from datetime import datetime
from typing import Any

from sqlalchemy.sql.expression import or_
from sqlmodel import Session, asc, col, func, select

from app.models import Arp, ArpCreate, ArpUpdate, Device


def get_arps(
    session: Session,
    skip: int,
    limit: int,
    device_id: int,
    search: str = "",
    since: datetime | None = None,
):
    if since is not None and since.tzinfo is not None:
        since = since.replace(tzinfo=None)

    if device_id > 0:
        statement = (
            select(Arp)
            .where(Arp.device_id == device_id)
            .filter(
                or_(
                    Arp.ip.contains(search),
                    Arp.mac.contains(search),
                    Arp.interface.contains(search),
                )
            )
        )
        if since is not None:
            statement = statement.where(col(Arp.created_at) >= since)
        statement = statement.order_by(asc(Arp.ip))
        return session.exec(statement.offset(skip).limit(limit)).all()
    else:
        statement = (
            select(Arp, Device)
            .join(Device)
            .filter(
                or_(
                    Arp.ip.contains(search),
                    Arp.mac.contains(search),
                    Arp.interface.contains(search),
                )
            )
        )
        if since is not None:
            statement = statement.where(col(Arp.created_at) >= since)
        arps = session.exec(statement.offset(skip).limit(limit)).all()
        list_arps = []
        for arp_db, device_db in arps:
            arp_info = arp_db.__dict__
            arp_info["device_hostname"] = device_db.hostname
            list_arps.append(arp_info)
        return list_arps


def get_arps_count(
    session: Session,
    device_id: int,
    search: str = "",
    since: datetime | None = None,
):
    if since is not None and since.tzinfo is not None:
        since = since.replace(tzinfo=None)

    count_statement = (
        select(func.count())
        .select_from(Arp)
        .filter(
            or_(
                Arp.ip.contains(search),
                Arp.mac.contains(search),
                Arp.interface.contains(search),
            )
        )
    )
    if device_id > 0:
        count_statement = count_statement.where(Arp.device_id == device_id)
    if since is not None:
        count_statement = count_statement.where(col(Arp.created_at) >= since)
    return session.exec(count_statement).one()


def get_arp_by_id(session: Session, id: int):
    return session.get(Arp, id)


def get_arp_by_ip(
    session: Session,
    ip: str,
    mac: str,
    interface: str,
    device_id: int,
) -> Arp | None:
    statement = select(Arp).where(
        Arp.ip == ip,
        Arp.device_id == device_id,
        Arp.interface == interface,
        Arp.mac == mac,
    )
    return session.exec(statement).first()


def create_arp(session: Session, arp_in: ArpCreate) -> Arp:
    arp = Arp.model_validate(arp_in)
    session.add(arp)
    session.commit()
    session.refresh(arp)
    return arp


def update_arp(*, session: Session, arp_db: Arp, arp_in: ArpUpdate) -> Any:
    update_dict = arp_in.model_dump(exclude_unset=True)
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


def delete_arp_by_device_id(session: Session, device_id: int):
    arps = session.exec(select(Arp).where(Arp.device_id == device_id)).all()
    for arp in arps:
        session.delete(arp)
        session.commit()
    return True


def update_arp_running(session: Session, arps_in: dict, device_id: int) -> Any:
    for arp_in in arps_in:
        arp_in["mac"] = arp_in["mac"].lower().replace(":", "")
        arp_in["device_id"] = device_id
        arp_in["age"] = 0
        if arp_in["age"]:
            arp_in["age"] = int(arp_in["age"])
        arp_db = get_arp_by_ip(
            session=session,
            ip=arp_in["ip"],
            mac=arp_in["mac"],
            interface=arp_in["interface"],
            device_id=device_id,
        )
        if arp_db:
            update_arp(session=session, arp_db=arp_db, arp_in=ArpUpdate(**arp_in))
        else:
            create_arp(session=session, arp_in=ArpCreate(**arp_in))
    return True
