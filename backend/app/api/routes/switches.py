from typing import Any

from fastapi import APIRouter, HTTPException, Request

from app.api.deps import CurrentUser, SessionDep
from app.crud.arps import delete_arp_by_switch_id
from app.crud.audit import write_audit_log
from app.crud.interfaces import delete_interface_by_switch_id
from app.crud.ip_interfaces import delete_ip_interface_by_switch_id
from app.crud.mac_addresses import delete_mac_by_switch_id
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
    switch_update = update_switch_metadata_db(session=session, switch_db=switch)

    return switch_update


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
    switch_update = update_switch_metadata_db(session=session, switch_db=switch)

    return switch_update
