from typing import Any
import yaml
from fastapi import APIRouter, HTTPException
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Switch,
    SwitchCreate,
    SwitchPublic,
    SwitchesPublic,
    SwitchUpdate,
    Message,
)
from app.automation.scripts import switches
from app.core.config import settings


router = APIRouter()


@router.get("/", response_model=SwitchesPublic)
def read_switches(
    session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 100
) -> Any:
    """
    Retrieve switches.
    """

    if current_user.is_superuser:
        count_statement = select(func.count()).select_from(Switch)
        count = session.exec(count_statement).one()
        statement = select(Switch).offset(skip).limit(limit)
        switches = session.exec(statement).all()
    else:
        count_statement = select(func.count()).select_from(Switch)
        count = session.exec(count_statement).one()
        statement = select(Switch).offset(skip).limit(limit)
        switches = session.exec(statement).all()

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

    statement = select(Switch)
    switches = session.exec(statement).all()

    switch_ditc = {
        switch_in.hostname: {
            "hostname": switch_in.ipaddress,
            "username": settings.NETWORK_USERNAME,
            "password": settings.NETWORK_PASSWORD,
            "platform": switch_in.platform,
            "device_type": switch_in.device_type,
            "groups": switch_in.groups.split(","),
        }
    }

    for switch in switches:
        switch_info = switch.model_dump(exclude_unset=True)
        switch_ditc[switch_info["hostname"]] = {
            "hostname": switch_info["ipaddress"],
            "username": settings.NETWORK_USERNAME,
            "password": settings.NETWORK_PASSWORD,
            "platform": switch_info["platform"],
            "device_type": switch_info["device_type"],
            "groups": switch_info["groups"].split(","),
        }

    with open("./app/automation/inventory/hosts.yaml", "w") as file:
        yaml.dump(switch_ditc, file, default_flow_style=False)
    switch = Switch.model_validate(switch_in)
    session.add(switch)
    session.commit()
    session.refresh(switch)
    return switch


@router.put("/{id}", response_model=SwitchPublic)
def update_switch(
    *, session: SessionDep, current_user: CurrentUser, id: int, switch_in: SwitchUpdate
) -> Any:
    """
    Update an switch.
    """
    switch = session.get(Switch, id)
    if not switch:
        raise HTTPException(status_code=404, detail="Switch not found")
    update_dict = switch_in.model_dump(exclude_unset=True)
    switch.sqlmodel_update(update_dict)
    session.add(switch)
    session.commit()
    session.refresh(switch)
    return switch


@router.delete("/{id}")
def delete_switch(session: SessionDep, current_user: CurrentUser, id: int) -> Message:
    """
    Delete an switch.
    """
    switch = session.get(Switch, id)
    if not switch:
        raise HTTPException(status_code=404, detail="Switch not found")
    session.delete(switch)
    session.commit()
    return Message(message="Switch deleted successfully")


@router.put("/{id}/metadata")
def update_switch_metadata(
    *, session: SessionDep, current_user: CurrentUser, id: int, switch_in: SwitchUpdate
) -> Any:
    """
    Update an switch.
    """

    switch = session.get(Switch, id)
    if not switch:
        raise HTTPException(status_code=404, detail="Switch not found")

    update_dict = switch_in.model_dump(exclude_unset=True)

    facts = switches.get_metadata(hostname=update_dict["hostname"])
    print(facts)
    update_dict["model"] = facts[update_dict["hostname"]]["get_facts"]["model"]
    update_dict["os_version"] = facts[update_dict["hostname"]]["get_facts"][
        "os_version"
    ]
    update_dict["serial_number"] = facts[update_dict["hostname"]]["get_facts"][
        "serial_number"
    ]
    update_dict["vendor"] = facts[update_dict["hostname"]]["get_facts"]["vendor"]

    switch.sqlmodel_update(update_dict)
    session.add(switch)
    session.commit()
    session.refresh(switch)
    return switch
