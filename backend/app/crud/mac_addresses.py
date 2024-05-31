from datetime import datetime
from typing import Any
from sqlmodel import Session, select, func

from app.models import MacAddress, MacAddressCreate, MacAddressUpdate


def get_mac_addresses(
    session: Session, skip: int, limit: int, mac: str, interface: str, switch_id: int
):

    statement = select(MacAddress)
    if mac:
        statement = statement.where(MacAddress.mac == mac)
    if interface:
        statement = statement.where(MacAddress.interface == interface)
    if switch_id > 0:
        statement = statement.where(MacAddress.switch_id == switch_id)
    mac_addresses = session.exec(statement.offset(skip).limit(limit)).all()
    return mac_addresses


def get_mac_address_by_id(
    session: Session,
    id: int,
):

    mac_address = session.get(MacAddress, id)
    return mac_address


def get_mac_addresses_count(
    session: Session, skip: int, limit: int, mac: str, interface: str, switch_id: int
):

    count_statement = select(func.count()).select_from(MacAddress)
    if mac:
        count_statement = count_statement.where(MacAddress.mac == mac)
    if interface:
        count_statement = count_statement.where(MacAddress.interface == interface)
    if switch_id > 0:
        count_statement = count_statement.where(MacAddress.switch_id == switch_id)
    count = session.exec(count_statement).one()
    return count


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
    """
    Update an mac_address.
    """

    update_dict = mac_address_in.__dict__
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


def update_mac_address_running(
    session: Session, mac_addresses_in: dict, switch_id: int
) -> Any:

    for mac_address_in in mac_addresses_in:
        mac_address_in["mac"] = mac_address_in["mac"].lower().replace(":", "")
        mac_address_in["switch_id"] = switch_id
        mac_address_db = get_mac_addresses(
            session=session,
            mac=mac_address_in["mac"],
            switch_id=switch_id,
            interface=mac_address_in["interface"],
            limit=100,
            skip=0,
        )
        if mac_address_db:
            update_mac_address(
                session=session,
                mac_address_db=mac_address_db[0],
                mac_address_in=MacAddressUpdate(**mac_address_in),
            )
        else:
            create_mac_address(
                session=session, mac_address_in=MacAddressCreate(**mac_address_in)
            )
    return True
