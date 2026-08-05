import asyncio
import json
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from sqlmodel import select

from app.api.deps import CurrentUser, SessionDep, get_client_ip
from app.automation.devices import DeviceAuthenticationError, DeviceConnectionError
from app.automation.health import check_device, check_devices_parallel
from app.crud.arps import delete_arp_by_device_id
from app.crud.audit import redact_sensitive, write_audit_log
from app.crud.compliance import (
    delete_runs_by_device_id as delete_compliance_by_device_id,
)
from app.crud.config_revisions import (
    delete_revisions_by_device_id,
    snapshot_device_config,
)
from app.crud.device_config import create_device_config as create_device_config_model
from app.crud.devices import (
    create_device as create_device_db,
)
from app.crud.devices import (
    delete_device as delete_device_db,
)
from app.crud.devices import (
    get_device_by_name,
    get_devices,
    get_devices_count,
)
from app.crud.devices import (
    update_device as update_device_db,
)
from app.crud.devices import (
    update_device_metadata as update_device_metadata_db,
)
from app.crud.interfaces import delete_interface_by_device_id
from app.crud.ip_interfaces import delete_ip_interface_by_device_id
from app.crud.mac_addresses import delete_mac_by_device_id
from app.models import (
    Device,
    DeviceConfigCreate,
    DeviceCreate,
    DevicePublic,
    DevicesPublic,
    DeviceUpdate,
    Message,
)

router = APIRouter()


@router.get("/", response_model=DevicesPublic)
def read_devices(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 200,
    ipaddress: str = "",
    hostname: str = "",
    search: str = "",
) -> Any:
    """
    Retrieve devices.
    """

    devices = get_devices(
        session=session,
        skip=skip,
        limit=limit,
        ipaddress=ipaddress,
        hostname=hostname,
        search=search,
    )
    count = get_devices_count(session=session, skip=skip, limit=limit, search=search)

    return DevicesPublic(data=devices, count=count)


@router.post("/health")
def health_check_all(session: SessionDep, current_user: CurrentUser) -> Any:
    """
    TCP-connect health check for all devices. Updates health_status in DB.
    """
    devices = session.exec(select(Device)).all()
    payload = [{"id": s.id, "ip": s.ipaddress, "port": s.port or 22} for s in devices]
    results = check_devices_parallel(payload)
    response_results = {}
    for s in devices:
        if s.id is not None:
            new_status = results.get(s.id, "DOWN")
            if new_status == "UP" and s.health_status == "AUTH_ERROR":
                new_status = "AUTH_ERROR"
            s.health_status = new_status
            response_results[s.id] = new_status
        session.add(s)
    session.commit()
    return response_results


@router.post("/{id}/health")
def health_check_one(session: SessionDep, current_user: CurrentUser, id: int) -> Any:
    """
    TCP-connect health check for a single device. Updates health_status in DB.
    """
    device = session.get(Device, id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    status = check_device(device.ipaddress, device.port or 22)
    if status == "UP" and device.health_status == "AUTH_ERROR":
        status = "AUTH_ERROR"
    device.health_status = status
    session.add(device)
    session.commit()
    return {"id": id, "health_status": status}


@router.get("/{id}", response_model=DevicePublic)
def read_device(session: SessionDep, current_user: CurrentUser, id: int) -> Any:
    """
    Get device by ID.
    """
    device = session.get(Device, id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device


@router.post("/", response_model=DevicePublic)
def create_device(
    *,
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    device_in: DeviceCreate,
) -> Any:
    """
    Create new device.
    """
    if not (device_in.hostname.isalnum() or "_" in device_in.hostname):
        return {"status": False, "message": "device hostname has [a-zA-Z0-9_] only"}
    device_db = get_device_by_name(session=session, hostname=device_in.hostname)
    if device_db:
        raise HTTPException(status_code=400, detail="Device hostname already exists")
    device = create_device_db(session=session, device_in=device_in)
    write_audit_log(
        session,
        username=current_user.email,
        action="create_switch",
        client_ip=get_client_ip(request),
        message=f"Created device {device_in.hostname}",
    )
    return device


@router.put("/{id}", response_model=DevicePublic)
def update_device(
    *,
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    id: int,
    device_in: DeviceUpdate,
) -> Any:
    """
    Update an device.
    """
    device_db = session.get(Device, id)
    if not device_db:
        raise HTTPException(status_code=404, detail="Device not found")
    device = update_device_db(session=session, device_db=device_db, device_in=device_in)
    write_audit_log(
        session,
        username=current_user.email,
        action="update_switch",
        client_ip=get_client_ip(request),
        message=f"Updated device {device_db.hostname}",
    )
    return device


@router.delete("/{id}", response_model=Message)
def delete_device(
    request: Request, session: SessionDep, current_user: CurrentUser, id: int
) -> Message:
    """
    Delete an device.
    """
    device = session.get(Device, id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    hostname = device.hostname
    device_id = device.id or 0
    delete_mac_by_device_id(session=session, device_id=device_id)
    delete_arp_by_device_id(session=session, device_id=device_id)
    delete_interface_by_device_id(session=session, device_id=device_id)
    delete_ip_interface_by_device_id(session=session, device_id=device_id)
    delete_revisions_by_device_id(session=session, device_id=device_id)
    delete_compliance_by_device_id(session, device_id)
    delete_device_db(session=session, device_db=device)
    write_audit_log(
        session,
        username=current_user.email,
        action="delete_switch",
        client_ip=get_client_ip(request),
        message=f"Deleted device {hostname}",
        severity="WARNING",
    )
    return Message(message="Device deleted successfully")


@router.put("/{id}/metadata")
def update_device_metadata(
    *, session: SessionDep, current_user: CurrentUser, id: int
) -> Any:
    """
    Update an device.
    """

    device = session.get(Device, id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    try:
        device_update = update_device_metadata_db(session=session, device_db=device)
        return device_update
    except DeviceAuthenticationError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Authentication failed: wrong username/password. {exc}",
        )
    except DeviceConnectionError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Connection failed: {exc}",
        )


@router.post("/{id}/config")
async def create_device_config(
    *,
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    id: int,
    config_in: DeviceConfigCreate,
) -> Any:
    """
    Push config or run show command against a single device.
    """
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    device = session.get(Device, id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    snapshot_warning = ""
    if config_in.command_type == "config":
        try:
            await asyncio.to_thread(
                snapshot_device_config,
                session,
                device,
                action="pre_push",
                username=current_user.email,
                user_email=current_user.email,
            )
        except Exception as exc:  # snapshot failure must never block the push
            session.rollback()
            snapshot_warning = f"pre-push snapshot failed: {exc}"

    result = await asyncio.to_thread(
        create_device_config_model, config_in, device.hostname
    )

    if config_in.command_type == "config":
        try:
            await asyncio.to_thread(
                snapshot_device_config,
                session,
                device,
                action="post_push",
                username=current_user.email,
                user_email=current_user.email,
                commands=config_in.commands,
                command_type=config_in.command_type,
            )
        except Exception as exc:
            session.rollback()
            snapshot_warning = (
                snapshot_warning + "; " if snapshot_warning else ""
            ) + f"post-push snapshot failed: {exc}"

    write_audit_log(
        session,
        username=current_user.email,
        action="push_switch_config",
        client_ip=get_client_ip(request),
        message=f"Pushed {config_in.command_type} to device {device.hostname}: {redact_sensitive(config_in.commands)[:200]}",
        severity="WARNING" if config_in.command_type == "config" else "INFO",
    )
    if snapshot_warning:
        write_audit_log(
            session,
            username=current_user.email,
            action="snapshot_config",
            client_ip=get_client_ip(request),
            message=f"Device {device.hostname}: {snapshot_warning}",
            severity="WARNING",
        )
    response: dict[str, Any] = {
        "status": True,
        "message": json.dumps(result, default=str),
    }
    if snapshot_warning:
        response["snapshot_warning"] = snapshot_warning
    return response


@router.put("/metadata")
def update_device_metadata_by_query(
    *, session: SessionDep, current_user: CurrentUser, id: int
) -> Any:
    """
    Update a device's metadata (id passed as query param).
    """

    device = session.get(Device, id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    try:
        device_update = update_device_metadata_db(session=session, device_db=device)
        return device_update
    except DeviceAuthenticationError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Authentication failed: wrong username/password. {exc}",
        )
    except DeviceConnectionError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Connection failed: {exc}",
        )
