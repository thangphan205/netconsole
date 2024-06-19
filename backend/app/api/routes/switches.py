from typing import Any
from fastapi import APIRouter, HTTPException
from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Switch,
    SwitchCreate,
    SwitchPublic,
    SwitchesPublic,
    SwitchUpdate,
    Message,
)

from app.crud.switches import (
    get_switches,
    get_switches_count,
    get_switch_by_name,
    create_switch as create_switch_db,
    update_switch as update_switch_db,
    update_switch_metadata as update_switch_metadata_db,
    delete_switch as delete_switch_db,
)
from app.crud.mac_addresses import delete_mac_by_switch_id
from app.crud.arps import delete_arp_by_switch_id
from app.crud.interfaces import delete_interface_by_switch_id
from app.crud.ip_interfaces import delete_ip_interface_by_switch_id

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


@router.post("/")
def create_switch(
    *, session: SessionDep, current_user: CurrentUser, switch_in: SwitchCreate
) -> Any:
    """
    Create new switch.
    """
    if not (switch_in.hostname.isalnum() or "_" in switch_in.hostname):
        return {"status": False, "message": "switch hostname has [a-zA-Z0-9_] only"}
    switch_db = get_switch_by_name(session=session, hostname=switch_in.hostname)
    if switch_db:
        raise HTTPException(status_code=404, detail="Switch hostname is existed!")
    switch = create_switch_db(session=session, switch_in=switch_in)
    return switch


@router.put("/{id}", response_model=SwitchPublic)
def update_switch(
    *, session: SessionDep, current_user: CurrentUser, id: int, switch_in: SwitchUpdate
) -> Any:
    """
    Update an switch.
    """
    switch_db = session.get(Switch, id)
    if not switch_db:
        raise HTTPException(status_code=404, detail="Switch not found")
    switch = update_switch_db(session=session, switch_db=switch_db, switch_in=switch_in)

    return switch


@router.delete("/{id}")
def delete_switch(session: SessionDep, current_user: CurrentUser, id: int) -> Message:
    """
    Delete an switch.
    """
    switch = session.get(Switch, id)
    if not switch:
        raise HTTPException(status_code=404, detail="Switch not found")
    delete_mac_by_switch_id(session=session, switch_id=switch.id)
    delete_arp_by_switch_id(session=session, switch_id=switch.id)
    delete_interface_by_switch_id(session=session, switch_id=switch.id)
    delete_ip_interface_by_switch_id(session=session, switch_id=switch.id)
    delete_switch_db(session=session, switch_db=switch)
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
