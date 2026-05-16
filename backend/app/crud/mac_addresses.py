from datetime import datetime
from typing import Any

from sqlalchemy.sql.expression import or_
from sqlmodel import Session, asc, col, func, select

from app.models import MacAddress, MacAddressCreate, MacAddressUpdate, Switch


def get_mac_addresses(
    session: Session,
    skip: int,
    limit: int,
    switch_id: int,
    search: str = "",
    since: datetime | None = None,
):
    if since is not None and since.tzinfo is not None:
        since = since.replace(tzinfo=None)

    if switch_id > 0:
        statement = (
            select(MacAddress)
            .where(MacAddress.switch_id == switch_id)
            .filter(
                or_(
                    MacAddress.mac.contains(search),
                    MacAddress.interface.contains(search),
                )
            )
            .order_by(asc(MacAddress.mac))
        )
        if since is not None:
            statement = statement.where(col(MacAddress.created_at) >= since)
        return session.exec(statement.offset(skip).limit(limit)).all()
    else:
        statement = (
            select(MacAddress, Switch)
            .join(Switch)
            .filter(
                or_(
                    MacAddress.mac.contains(search),
                    Switch.hostname.contains(search),
                )
            )
            .order_by(asc(MacAddress.mac))
        )
        if since is not None:
            statement = statement.where(col(MacAddress.created_at) >= since)
        mac_addresses = session.exec(statement.offset(skip).limit(limit)).all()
        list_mac_addresses = []
        for mac_address_db, switch_db in mac_addresses:
            mac_address_info = mac_address_db.__dict__
            mac_address_info["switch_hostname"] = switch_db.hostname
            list_mac_addresses.append(mac_address_info)
        return list_mac_addresses


def get_mac_addresses_count(
    session: Session,
    switch_id: int,
    search: str = "",
    since: datetime | None = None,
):
    if since is not None and since.tzinfo is not None:
        since = since.replace(tzinfo=None)

    count_statement = (
        select(func.count())
        .select_from(MacAddress)
        .filter(
            or_(
                MacAddress.mac.contains(search),
                MacAddress.interface.contains(search),
            )
        )
    )
    if switch_id > 0:
        count_statement = count_statement.where(MacAddress.switch_id == switch_id)
    if since is not None:
        count_statement = count_statement.where(col(MacAddress.created_at) >= since)
    return session.exec(count_statement).one()


def get_mac_address_by_id(session: Session, id: int):
    return session.get(MacAddress, id)


def get_mac_addresses_by_mac(
    *, session: Session, mac: str, switch_id: int, interface: str
) -> MacAddress | None:
    statement = select(MacAddress).where(
        MacAddress.mac == mac,
        MacAddress.switch_id == switch_id,
        MacAddress.interface == interface,
    )
    return session.exec(statement).first()


def create_mac_address(
    session: Session, mac_address_in: MacAddressCreate
) -> MacAddress:
    mac_address = MacAddress.model_validate(mac_address_in)
    session.add(mac_address)
    session.commit()
    session.refresh(mac_address)
    return mac_address


def update_mac_address(
    *, session: Session, mac_address_db: MacAddress, mac_address_in: MacAddressUpdate
) -> Any:
    update_dict = mac_address_in.model_dump(exclude_unset=True)
    update_dict["updated_at"] = datetime.now()
    mac_address_db.sqlmodel_update(update_dict)
    session.add(mac_address_db)
    session.commit()
    session.refresh(mac_address_db)
    return mac_address_db


def delete_mac_address(session: Session, mac_address_db: MacAddress):
    session.delete(mac_address_db)
    session.commit()
    return True


def delete_mac_by_switch_id(session: Session, switch_id: int):
    macs = session.exec(
        select(MacAddress).where(MacAddress.switch_id == switch_id)
    ).all()
    for mac in macs:
        session.delete(mac)
        session.commit()
    return True


def update_mac_address_running(
    session: Session, mac_addresses_in: dict, switch_id: int
) -> Any:
    for mac_address_in in mac_addresses_in:
        mac_address_in["mac"] = mac_address_in["mac"].lower().replace(":", "")
        mac_address_in["switch_id"] = switch_id
        mac_address_db = get_mac_addresses_by_mac(
            session=session,
            mac=mac_address_in["mac"],
            switch_id=switch_id,
            interface=mac_address_in["interface"],
        )
        if mac_address_db:
            update_mac_address(
                session=session,
                mac_address_db=mac_address_db,
                mac_address_in=MacAddressUpdate(**mac_address_in),
            )
        else:
            create_mac_address(
                session=session, mac_address_in=MacAddressCreate(**mac_address_in)
            )
    return True
