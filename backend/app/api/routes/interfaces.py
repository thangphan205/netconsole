from typing import Any

from fastapi import APIRouter, HTTPException, Request

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
    get_interface_running,
    create_interface as create_interface_db,
    update_interface as update_interface_db,
    update_interface_status as update_interface_status_db,
)
from app.crud.switches import get_switch_by_id
import logging
from app.logging_config import LOG_LEVEL, LOG_FORMAT

# Configure logging
logging.basicConfig(level=LOG_LEVEL, format=LOG_FORMAT)
logger = logging.getLogger(__name__)

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
    interface_in: InterfaceUpdate
) -> Any:
    """
    Update an interface.
    """
    interface_db = session.get(Interface, id)
    if not interface_db:
        raise HTTPException(status_code=404, detail="Interface not found")
    switch_db = get_switch_by_id(session=session, id=interface_db.switch_id)
    logger.info(
        "{} - {} - Update interface {}".format(
            current_user.email, request.client.host, interface_db.port
        )
    )
    interface = update_interface_db(
        session=session,
        interface_db=interface_db,
        interface_in=interface_in,
        switch=switch_db,
    )
    return interface


@router.put("/{id}/status", response_model=InterfacePublic)
def update_interface_status(
    *,
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    id: int,
    set_status: int = 1
) -> Any:
    """
    Update an interface.
    """
    interface_db = session.get(Interface, id)
    if not interface_db:
        raise HTTPException(status_code=404, detail="Interface not found")
    switch_db = get_switch_by_id(session=session, id=interface_db.switch_id)
    logger.info(
        "{} - {} - Update interface {} set_status {}".format(
            current_user.email, request.client.host, interface_db.port, set_status
        )
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
    return True
    # interface_db = session.get(Interface, id)
    # if not interface_db:
    #     raise HTTPException(status_code=404, detail="Interface not found")
    # delete_interface_db(session=session, interface_db=interface_db)
    # return Message(message="Interface deleted successfully")
