from typing import Any

from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Interface,
    InterfaceCreate,
    InterfacePublic,
    InterfacesPublic,
    InterfaceUpdate,
    Message,
)
from app.crud.interfaces import (
    get_interfaces,
    get_interfaces_count,
    create_interface as create_interface_db,
    update_interface as update_interface_db,
)

router = APIRouter()


@router.get("/", response_model=InterfacesPublic)
def read_interfaces(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    port: str = "",
    switch_id: int = 0,
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
    )
    count = get_interfaces_count(
        session=session, switch_id=switch_id, skip=skip, limit=limit
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
    session: SessionDep,
    current_user: CurrentUser,
    id: int,
    interface_in: InterfaceUpdate
) -> Any:
    """
    Update an interface.
    """
    interface_db = session.get(Interface, id)
    if not interface_db:
        raise HTTPException(status_code=404, detail="Interface not found")

    interface = update_interface_db(
        session=session, interface_db=interface_db, interface_in=interface_in
    )
    return interface


@router.delete("/{id}")
def delete_interface(
    session: SessionDep, current_user: CurrentUser, id: int
) -> Message:
    """
    Delete an interface.
    """
    return True
    # interface_db = session.get(Interface, id)
    # if not interface_db:
    #     raise HTTPException(status_code=404, detail="Interface not found")
    # delete_interface_db(session=session, interface_db=interface_db)
    # return Message(message="Interface deleted successfully")
