from typing import Any
from fastapi import APIRouter, HTTPException
from app.api.deps import CurrentUser, SessionDep
from app.models import (
    MacAddress,
    MacAddressCreate,
    MacAddressPublic,
    MacAddressesPublic,
    MacAddressUpdate,
    Message,
)

from app.crud.mac_addresses import (
    get_mac_addresses,
    get_mac_addresses_count,
    create_mac_address as create_mac_address_db,
    update_mac_address as update_mac_address_db,
    delete_mac_address as delete_mac_address_db,
)

router = APIRouter()


@router.get("/", response_model=MacAddressesPublic)
def read_mac_addresses(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    mac: str = "",
    interface: str = "",
    switch_id: int = 0,
) -> Any:
    """
    Retrieve mac_addresses.
    """

    mac_addresses = get_mac_addresses(
        session=session,
        skip=skip,
        limit=limit,
        mac=mac,
        interface=interface,
        switch_id=switch_id,
    )
    count = get_mac_addresses_count(
        session=session,
        skip=skip,
        limit=limit,
        mac=mac,
        interface=interface,
        switch_id=switch_id,
    )

    return MacAddressesPublic(data=mac_addresses, count=count)


@router.get("/{id}", response_model=MacAddressPublic)
def read_mac_address(session: SessionDep, current_user: CurrentUser, id: int) -> Any:
    """
    Get mac_address by ID.
    """
    mac_address = session.get(MacAddress, id)
    if not mac_address:
        raise HTTPException(status_code=404, detail="MacAddress not found")
    return mac_address


@router.post("/")
def create_mac_address(
    *, session: SessionDep, current_user: CurrentUser, mac_address_in: MacAddressCreate
) -> Any:
    """
    Create new mac_address.
    """

    mac_address = create_mac_address_db(session=session, mac_address_in=mac_address_in)
    return mac_address


@router.put("/{id}", response_model=MacAddressPublic)
def update_mac_address(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: int,
    mac_address_in: MacAddressUpdate
) -> Any:
    """
    Update an mac_address.
    """
    mac_address_db = session.get(MacAddress, id)
    if not mac_address_db:
        raise HTTPException(status_code=404, detail="MacAddress not found")
    mac_address = update_mac_address_db(
        session=session, mac_address_db=mac_address_db, mac_address_in=mac_address_in
    )

    return mac_address


@router.delete("/{id}")
def delete_mac_address(
    session: SessionDep, current_user: CurrentUser, id: int
) -> Message:
    """
    Delete an mac_address.
    """
    mac_address = session.get(MacAddress, id)
    if not mac_address:
        raise HTTPException(status_code=404, detail="MacAddress not found")
    delete_mac_address_db(session=session, mac_address_db=mac_address)
    return Message(message="MacAddress deleted successfully")
