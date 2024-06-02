from typing import Any
from fastapi import APIRouter, HTTPException
from app.api.deps import CurrentUser, SessionDep
from app.models import (
    IpInterface,
    IpInterfaceCreate,
    IpInterfacePublic,
    IpInterfacesPublic,
    IpInterfaceUpdate,
    Message,
)

from app.crud.ip_interfaces import (
    get_ip_interfaces,
    get_ip_interfaces_count,
    create_ip_interface as create_ip_interface_db,
    update_ip_interface as update_ip_interface_db,
    delete_ip_interface as delete_ip_interface_db,
)

router = APIRouter()


@router.get("/", response_model=IpInterfacesPublic)
def read_ip_interfaces(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    interface: str = "",
    ipv4: str = "",
    switch_id: int = 0,
) -> Any:
    """
    Retrieve ip_interfaces.
    """

    ip_interfaces = get_ip_interfaces(
        session=session,
        skip=skip,
        limit=limit,
        interface=interface,
        ipv4=ipv4,
        switch_id=switch_id,
    )
    count = get_ip_interfaces_count(
        session=session,
        skip=skip,
        limit=limit,
        interface=interface,
        ipv4=ipv4,
        switch_id=switch_id,
    )

    return IpInterfacesPublic(data=ip_interfaces, count=count)


@router.get("/{id}", response_model=IpInterfacePublic)
def read_ip_interface(session: SessionDep, current_user: CurrentUser, id: int) -> Any:
    """
    Get ip_interface by ID.
    """
    ip_interface = session.get(IpInterface, id)
    if not ip_interface:
        raise HTTPException(status_code=404, detail="IpInterface not found")
    return ip_interface


@router.post("/")
def create_ip_interface(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    ip_interface_in: IpInterfaceCreate
) -> Any:
    """
    Create new ip_interface.
    """

    ip_interface = create_ip_interface_db(
        session=session, ip_interface_in=ip_interface_in
    )
    return ip_interface


@router.put("/{id}", response_model=IpInterfacePublic)
def update_ip_interface(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: int,
    ip_interface_in: IpInterfaceUpdate
) -> Any:
    """
    Update an ip_interface.
    """
    ip_interface_db = session.get(IpInterface, id)
    if not ip_interface_db:
        raise HTTPException(status_code=404, detail="IpInterface not found")
    ip_interface = update_ip_interface_db(
        session=session,
        ip_interface_db=ip_interface_db,
        ip_interface_in=ip_interface_in,
    )

    return ip_interface


@router.delete("/{id}")
def delete_ip_interface(
    session: SessionDep, current_user: CurrentUser, id: int
) -> Message:
    """
    Delete an ip_interface.
    """
    ip_interface = session.get(IpInterface, id)
    if not ip_interface:
        raise HTTPException(status_code=404, detail="IpInterface not found")
    delete_ip_interface_db(session=session, ip_interface_db=ip_interface)
    return Message(message="IpInterface deleted successfully")
