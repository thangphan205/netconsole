import asyncio
import json
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from sqlmodel import select

from app.api.deps import CurrentUser, SessionDep
from app.automation.health import check_switch, check_switches_parallel
from app.automation.switches import SwitchAuthenticationError, SwitchConnectionError
from app.crud.arps import delete_arp_by_switch_id
from app.crud.audit import write_audit_log
from app.crud.interfaces import delete_interface_by_switch_id
from app.crud.ip_interfaces import delete_ip_interface_by_switch_id
from app.crud.mac_addresses import delete_mac_by_switch_id
from app.crud.switch_config import create_switch_config as create_switch_config_model
from app.crud.switches import (
    create_switch as create_switch_db,
)
from app.crud.switches import (
    delete_switch as delete_switch_db,
)
from app.crud.switches import (
    get_switch_by_name,
    get_switches,
    get_switches_count,
)
from app.crud.switches import (
    update_switch as update_switch_db,
)
from app.crud.switches import (
    update_switch_metadata as update_switch_metadata_db,
)
from app.models import (
    Message,
    Switch,
    SwitchConfigCreate,
    SwitchCreate,
    SwitchesPublic,
    SwitchPublic,
    SwitchUpdate,
)

router = APIRouter()


@router.get("/", response_model=SwitchesPublic)
def read_switches(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 200,
    ipaddress: str = "",
    hostname: str = "",
    search: str = "",
) -> Any:
    """
    Retrieve switches.
    """

    switches = get_switches(
        session=session,
        skip=skip,
        limit=limit,
        ipaddress=ipaddress,
        hostname=hostname,
        search=search,
    )
    count = get_switches_count(session=session, skip=skip, limit=limit, search=search)

    return SwitchesPublic(data=switches, count=count)


@router.post("/health")
def health_check_all(session: SessionDep, current_user: CurrentUser) -> Any:
    """
    TCP-connect health check for all switches. Updates health_status in DB.
    """
    switches = session.exec(select(Switch)).all()
    payload = [{"id": s.id, "ip": s.ipaddress, "port": s.port or 22} for s in switches]
    results = check_switches_parallel(payload)
    response_results = {}
    for s in switches:
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
    TCP-connect health check for a single switch. Updates health_status in DB.
    """
    switch = session.get(Switch, id)
    if not switch:
        raise HTTPException(status_code=404, detail="Switch not found")
    status = check_switch(switch.ipaddress, switch.port or 22)
    if status == "UP" and switch.health_status == "AUTH_ERROR":
        status = "AUTH_ERROR"
    switch.health_status = status
    session.add(switch)
    session.commit()
    return {"id": id, "health_status": status}


@router.get("/{id}", response_model=SwitchPublic)
def read_switch(session: SessionDep, current_user: CurrentUser, id: int) -> Any:
    """
    Get switch by ID.
    """
    switch = session.get(Switch, id)
    if not switch:
        raise HTTPException(status_code=404, detail="Switch not found")
    return switch


@router.post("/", response_model=SwitchPublic)
def create_switch(
    *,
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    switch_in: SwitchCreate,
) -> Any:
    """
    Create new switch.
    """
    if not (switch_in.hostname.isalnum() or "_" in switch_in.hostname):
        return {"status": False, "message": "switch hostname has [a-zA-Z0-9_] only"}
    switch_db = get_switch_by_name(session=session, hostname=switch_in.hostname)
    if switch_db:
        raise HTTPException(status_code=400, detail="Switch hostname already exists")
    switch = create_switch_db(session=session, switch_in=switch_in)
    write_audit_log(
        session,
        username=current_user.email,
        action="create_switch",
        client_ip=request.client.host if request.client else "",
        message=f"Created switch {switch_in.hostname}",
    )
    return switch


@router.put("/{id}", response_model=SwitchPublic)
def update_switch(
    *,
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    id: int,
    switch_in: SwitchUpdate,
) -> Any:
    """
    Update an switch.
    """
    switch_db = session.get(Switch, id)
    if not switch_db:
        raise HTTPException(status_code=404, detail="Switch not found")
    switch = update_switch_db(session=session, switch_db=switch_db, switch_in=switch_in)
    write_audit_log(
        session,
        username=current_user.email,
        action="update_switch",
        client_ip=request.client.host if request.client else "",
        message=f"Updated switch {switch_db.hostname}",
    )
    return switch


@router.delete("/{id}", response_model=Message)
def delete_switch(
    request: Request, session: SessionDep, current_user: CurrentUser, id: int
) -> Message:
    """
    Delete an switch.
    """
    switch = session.get(Switch, id)
    if not switch:
        raise HTTPException(status_code=404, detail="Switch not found")
    hostname = switch.hostname
    switch_id = switch.id or 0
    delete_mac_by_switch_id(session=session, switch_id=switch_id)
    delete_arp_by_switch_id(session=session, switch_id=switch_id)
    delete_interface_by_switch_id(session=session, switch_id=switch_id)
    delete_ip_interface_by_switch_id(session=session, switch_id=switch_id)
    delete_switch_db(session=session, switch_db=switch)
    write_audit_log(
        session,
        username=current_user.email,
        action="delete_switch",
        client_ip=request.client.host if request.client else "",
        message=f"Deleted switch {hostname}",
        severity="WARNING",
    )
    return Message(message="Switch deleted successfully")


@router.put("/{id}/metadata")
def update_switch_metadata(
    *, session: SessionDep, current_user: CurrentUser, id: int
) -> Any:
    """
    Update an switch.
    """

    switch = session.get(Switch, id)
    if not switch:
        raise HTTPException(status_code=404, detail="Switch not found")
    try:
        switch_update = update_switch_metadata_db(session=session, switch_db=switch)
        return switch_update
    except SwitchAuthenticationError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Authentication failed: wrong username/password. {exc}",
        )
    except SwitchConnectionError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Connection failed: {exc}",
        )


@router.post("/{id}/config")
async def create_switch_config(
    *,
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    id: int,
    config_in: SwitchConfigCreate,
) -> Any:
    """
    Push config or run show command against a single switch.
    """
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    switch = session.get(Switch, id)
    if not switch:
        raise HTTPException(status_code=404, detail="Switch not found")
    result = await asyncio.to_thread(
        create_switch_config_model, config_in, switch.hostname
    )
    write_audit_log(
        session,
        username=current_user.email,
        action="push_switch_config",
        client_ip=request.client.host if request.client else "",
        message=f"Pushed {config_in.command_type} to switch {switch.hostname}: {config_in.commands[:200]}",
        severity="WARNING" if config_in.command_type == "config" else "INFO",
    )
    return {"status": True, "message": json.dumps(result, default=str)}


@router.put("/metadata")
def update_switch_metadata_by_query(
    *, session: SessionDep, current_user: CurrentUser, id: int
) -> Any:
    """
    Update a switch's metadata (id passed as query param).
    """

    switch = session.get(Switch, id)
    if not switch:
        raise HTTPException(status_code=404, detail="Switch not found")
    try:
        switch_update = update_switch_metadata_db(session=session, switch_db=switch)
        return switch_update
    except SwitchAuthenticationError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Authentication failed: wrong username/password. {exc}",
        )
    except SwitchConnectionError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Connection failed: {exc}",
        )
