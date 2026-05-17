from typing import Any

from fastapi import APIRouter, HTTPException, Request

from app.api.deps import CurrentUser, SessionDep
from app.crud.audit import write_audit_log
from app.crud.interfaces import (
    create_interface as create_interface_db,
)
from app.crud.interfaces import (
    get_interface_running,
    get_interfaces,
    get_interfaces_count,
)
from app.crud.interfaces import (
    update_interface as update_interface_db,
)
from app.crud.interfaces import (
    update_interface_status as update_interface_status_db,
)
from app.crud.switches import get_switch_by_id
from app.models import (
    Interface,
    InterfaceCreate,
    InterfacePublic,
    InterfacesPublic,
    InterfaceUpdate,
    Message,
)

router = APIRouter()


@router.get("/", response_model=InterfacesPublic)
def read_interfaces(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 200,
    port: str = "",
    switch_id: int = 0,
    search: str = "",
) -> Any:
    """
    Retrieve interfaces.
    """

    interfaces = get_interfaces(
        session=session,
        switch_id=switch_id,
        skip=skip,
        limit=limit,
        port=port,
        search=search,
    )
    count = get_interfaces_count(
        session=session,
        switch_id=switch_id,
        skip=skip,
        limit=limit,
        search=search,
    )
    return InterfacesPublic(data=interfaces, count=count)


@router.get("/{id}", response_model=InterfacePublic)
def read_interface(session: SessionDep, current_user: CurrentUser, id: int) -> Any:
    """
    Get interface by ID.
    """
    interface = session.get(Interface, id)
    if not interface:
        raise HTTPException(status_code=404, detail="Interface not found")
    return interface


@router.get("/{id}/running")
def read_interface_running(
    session: SessionDep, current_user: CurrentUser, id: int
) -> Any:
    """
    Get interface by ID.
    """
    interface = session.get(Interface, id)

    if not interface:
        raise HTTPException(status_code=404, detail="Interface not found")
    switch_db = get_switch_by_id(session=session, id=interface.switch_id)
    interface_info = get_interface_running(
        session=session, switch=switch_db, port=interface.port
    )
    return {"data": interface_info[switch_db.hostname], "interface": interface.port}


@router.post("/", response_model=InterfacePublic)
def create_interface(
    *, session: SessionDep, current_user: CurrentUser, interface_in: InterfaceCreate
) -> Any:
    """
    Create new interface.
    """
    interface = create_interface_db(session=session, interface_in=interface_in)
    return interface


@router.put("/{id}", response_model=InterfacePublic)
def update_interface(
    *,
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    id: int,
    interface_in: InterfaceUpdate,
) -> Any:
    """
    Update an interface.
    """
    interface_db = session.get(Interface, id)
    if not interface_db:
        raise HTTPException(status_code=404, detail="Interface not found")
    switch_db = get_switch_by_id(session=session, id=interface_db.switch_id)
    interface = update_interface_db(
        session=session,
        interface_db=interface_db,
        interface_in=interface_in,
        switch=switch_db,
    )
    write_audit_log(
        session,
        username=current_user.email,
        action="update_interface",
        client_ip=request.client.host if request.client else "",
        message=f"Updated interface {interface_db.port}",
    )
    return interface


@router.put("/{id}/status", response_model=InterfacePublic)
def update_interface_status(
    *,
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    id: int,
    set_status: int = 1,
) -> Any:
    """
    Update an interface.
    """
    interface_db = session.get(Interface, id)
    if not interface_db:
        raise HTTPException(status_code=404, detail="Interface not found")
    switch_db = get_switch_by_id(session=session, id=interface_db.switch_id)
    write_audit_log(
        session,
        username=current_user.email,
        action="update_interface_status",
        client_ip=request.client.host if request.client else "",
        message=f"Set interface {interface_db.port} status={set_status}",
    )
    interface = update_interface_status_db(
        session=session,
        interface_db=interface_db,
        switch=switch_db,
        set_status=set_status,
    )
    return interface


@router.delete("/{id}")
def delete_interface(
    session: SessionDep, current_user: CurrentUser, id: int
) -> Message:
    """
    Delete an interface.
    """
    interface_db = session.get(Interface, id)
    if not interface_db:
        raise HTTPException(status_code=404, detail="Interface not found")
    session.delete(interface_db)
    session.commit()
    return Message(message="Interface deleted successfully")
