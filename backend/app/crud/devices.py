from datetime import datetime
from typing import Any

from sqlalchemy.sql.expression import or_
from sqlmodel import Session, asc, func, select

from app.automation.devices import (
    DeviceAuthenticationError,
    DeviceConnectionError,
    get_metadata,
    get_metadata_all,
    show_interfaces_status,
)
from app.crud.arps import update_arp_running
from app.crud.create_nornir import create_hosts
from app.crud.interfaces import update_interface_metadata
from app.crud.ip_interfaces import update_ip_interface_running
from app.crud.mac_addresses import update_mac_address_running
from app.models import Credential, Device, DeviceCreate, DeviceUpdate


def get_devices(
    session: Session,
    skip: int,
    limit: int,
    ipaddress: str,
    hostname: str,
    search: str = "",
):

    statement = select(Device).order_by(asc(Device.hostname))
    if ipaddress:
        statement = statement.where(Device.ipaddress == ipaddress)
    if hostname:
        statement = statement.where(Device.hostname == hostname)
    if search:
        statement = statement.filter(
            or_(
                Device.hostname.contains(search),
                Device.ipaddress.contains(search),
                Device.groups.contains(search),
                Device.platform.contains(search),
                Device.device_type.contains(search),
                Device.os_version.contains(search),
                Device.serial_number.contains(search),
                Device.description.contains(search),
            )
        )
    devices = session.exec(statement.offset(skip).limit(limit)).all()
    return devices


def get_device_by_id(session: Session, id: int):

    device = session.get(Device, id)
    return device


def get_device_by_name(session: Session, hostname: str):
    statement = select(Device).where(Device.hostname == hostname)
    devices = session.exec(statement).all()
    return devices


def _get_device_and_credential(session: Session):
    statement = select(Device, Credential).outerjoin(
        Credential, Device.credential_id == Credential.id
    )
    devices = session.exec(statement).all()
    return devices


def get_devices_count(session: Session, skip: int, limit: int, search: str = ""):

    count_statement = select(func.count()).select_from(Device)
    if search:
        count_statement = count_statement.filter(
            or_(
                Device.hostname.contains(search),
                Device.ipaddress.contains(search),
                Device.groups.contains(search),
                Device.platform.contains(search),
                Device.device_type.contains(search),
                Device.os_version.contains(search),
                Device.serial_number.contains(search),
                Device.description.contains(search),
            )
        )
    count = session.exec(count_statement).one()
    return count


def create_device(session: Session, device_in: DeviceCreate) -> Device:

    device = Device.model_validate(device_in)
    session.add(device)
    session.commit()
    session.refresh(device)
    # Generate new hosts.yaml file
    devices_db = _get_device_and_credential(session=session)
    create_hosts(devices_db)
    return device


def bulk_create_devices(
    session: Session, devices_in: list[DeviceCreate]
) -> list[Device]:
    """Insert many devices with a single commit and a single inventory regen."""
    devices = [Device.model_validate(s) for s in devices_in]
    for device in devices:
        session.add(device)
    session.commit()
    for device in devices:
        session.refresh(device)
    devices_db = _get_device_and_credential(session=session)
    create_hosts(devices_db)
    return devices


def update_device(
    *, session: Session, device_db: Device, device_in: DeviceUpdate
) -> Any:
    """
    Update an device.
    """

    update_dict = device_in.model_dump(exclude_unset=True)
    update_dict["updated_at"] = datetime.now()
    device_db.sqlmodel_update(update_dict)
    session.add(device_db)
    session.commit()
    session.refresh(device_db)

    # Generate new hosts.yaml file
    devices_db = _get_device_and_credential(session=session)
    create_hosts(devices_db)
    return device_db


def update_device_delete_group(*, session: Session, group_name: str) -> Any:
    """
    Update an device.
    """

    # Generate new hosts.yaml file
    statement = select(Device)
    devices_db = session.exec(statement).all()
    device_change_groups = []
    for device_db in devices_db:
        if device_db.groups and group_name in device_db.groups:
            device_change_groups.append(device_db.id)
    for device_id in device_change_groups:
        device_db = get_device_by_id(session=session, id=device_id)
        list_group = device_db.groups.split(",")
        list_group.remove(group_name)
        if list_group is not None:
            device_db.groups = ",".join(list_group)
        else:
            device_db.groups = ""
        session.add(device_db)
        session.commit()
        session.refresh(device_db)
    devices_db = _get_device_and_credential(session=session)
    create_hosts(devices_db)
    return True


def update_device_metadata(*, session: Session, device_db: Device) -> Any:
    """
    Update an device.
    """
    try:
        facts = get_metadata(device=device_db)
    except DeviceAuthenticationError as exc:
        device_db.health_status = "AUTH_ERROR"
        device_db.updated_at = datetime.now()
        session.add(device_db)
        session.commit()
        session.refresh(device_db)
        raise exc
    except DeviceConnectionError as exc:
        device_db.health_status = "DOWN"
        device_db.updated_at = datetime.now()
        session.add(device_db)
        session.commit()
        session.refresh(device_db)
        raise exc

    if facts:
        device_db.health_status = "UP"
        host_facts = facts.get(device_db.hostname, {})
        get_facts = host_facts.get("get_facts", {})

        if get_facts.get("model"):
            device_db.model = get_facts["model"]
        elif device_db.platform == "junos" and not device_db.model:
            device_db.model = "cRPD"

        if get_facts.get("os_version"):
            device_db.os_version = str(get_facts["os_version"])
        if get_facts.get("serial_number"):
            device_db.serial_number = str(get_facts["serial_number"])
        if get_facts.get("vendor"):
            device_db.vendor = get_facts["vendor"]
        elif device_db.platform == "junos" and not device_db.vendor:
            device_db.vendor = "Juniper"

        device_db.updated_at = datetime.now()
        session.add(device_db)
        session.commit()
        session.refresh(device_db)

        macs = host_facts.get("get_mac_address_table", [])
        arps = host_facts.get("get_arp_table", [])
        ips = host_facts.get("get_interfaces_ip", {})
        intfs_status = host_facts.get("get_interfaces", {})

        update_mac_address_running(
            session=session,
            mac_addresses_in=macs,
            device_id=device_db.id,
        )
        update_arp_running(
            session=session,
            arps_in=arps,
            device_id=device_db.id,
        )
        update_ip_interface_running(
            session=session,
            ip_interfaces_in=ips,
            device_id=device_db.id,
        )

        # Update interfaces safely:
        try:
            interfaces_in = show_interfaces_status(device=device_db)
        except Exception:
            interfaces_in = []

        update_interface_metadata(
            session=session,
            interfaces_in=interfaces_in,
            interfaces_status=intfs_status if device_db.platform == "junos" else {},
            device=device_db,
        )
        return device_db
    return False


def delete_device(session: Session, device_db: Device):

    session.delete(device_db)
    session.commit()
    devices_db = _get_device_and_credential(session=session)
    create_hosts(devices_db)
    return True


def update_device_metadata_all(*, session: Session, device_db: Device) -> Any:
    """
    Update all devices metadata.
    """

    facts = get_metadata_all()
    if facts:
        devices_db = get_devices(
            session=session, skip=0, limit=500, ipaddress="", hostname=""
        )
        for device_db in devices_db:
            if device_db.hostname in facts:
                host_facts = facts[device_db.hostname]
                get_facts = host_facts.get("get_facts", {})

                if get_facts.get("model"):
                    device_db.model = get_facts["model"]
                elif device_db.platform == "junos" and not device_db.model:
                    device_db.model = "cRPD"

                if get_facts.get("os_version"):
                    device_db.os_version = str(get_facts["os_version"])
                if get_facts.get("serial_number"):
                    device_db.serial_number = str(get_facts["serial_number"])
                if get_facts.get("vendor"):
                    device_db.vendor = get_facts["vendor"]
                elif device_db.platform == "junos" and not device_db.vendor:
                    device_db.vendor = "Juniper"

                device_db.updated_at = datetime.now()
                session.add(device_db)
                session.commit()
                session.refresh(device_db)

                macs = host_facts.get("get_mac_address_table", [])
                arps = host_facts.get("get_arp_table", [])
                ips = host_facts.get("get_interfaces_ip", {})
                intfs_status = host_facts.get("get_interfaces", {})

                update_mac_address_running(
                    session=session,
                    mac_addresses_in=macs,
                    device_id=device_db.id,
                )
                update_arp_running(
                    session=session,
                    arps_in=arps,
                    device_id=device_db.id,
                )
                update_ip_interface_running(
                    session=session,
                    ip_interfaces_in=ips,
                    device_id=device_db.id,
                )

                try:
                    interfaces_in = show_interfaces_status(device=device_db)
                except Exception:
                    interfaces_in = []

                update_interface_metadata(
                    session=session,
                    interfaces_in=interfaces_in,
                    interfaces_status=intfs_status
                    if device_db.platform == "junos"
                    else {},
                    device=device_db,
                )
    return True
