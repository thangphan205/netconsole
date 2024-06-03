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
    create_switch as create_switch_db,
    update_switch as update_switch_db,
    update_switch_metadata as update_switch_metadata_db,
    delete_switch as delete_switch_db,
)

router = APIRouter()


@router.get("/", response_model=SwitchesPublic)
def read_switches(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 500,
    ipaddress: str = "",
    hostname: str = "",
) -> Any:
    """
    Retrieve switches.
    """

    switches = get_switches(
        session=session, skip=skip, limit=limit, ipaddress=ipaddress, hostname=hostname
    )
    count = get_switches_count(session=session, skip=skip, limit=limit)

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
