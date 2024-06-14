from typing import Any
from fastapi import APIRouter, HTTPException
from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Arp,
    ArpCreate,
    ArpPublic,
    ArpsPublic,
    ArpUpdate,
    Message,
)

from app.crud.arps import (
    get_arps,
    get_arps_count,
    create_arp as create_arp_db,
    update_arp as update_arp_db,
    delete_arp as delete_arp_db,
)

router = APIRouter()


@router.get("/", response_model=ArpsPublic)
def read_arps(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 200,
    switch_id: int = 0,
    search: str = "",
) -> Any:
    """
    Retrieve arps.
    """

    arps = get_arps(
        session=session,
        skip=skip,
        limit=limit,
        switch_id=switch_id,
        search=search,
    )
    count = get_arps_count(
        session=session,
        skip=skip,
        limit=limit,
        switch_id=switch_id,
        search=search,
    )

    return ArpsPublic(data=arps, count=count)


@router.get("/{id}", response_model=ArpPublic)
def read_arp(session: SessionDep, current_user: CurrentUser, id: int) -> Any:
    """
    Get arp by ID.
    """
    arp = session.get(Arp, id)
    if not arp:
        raise HTTPException(status_code=404, detail="Arp not found")
    return arp


@router.post("/")
def create_arp(
    *, session: SessionDep, current_user: CurrentUser, arp_in: ArpCreate
) -> Any:
    """
    Create new arp.
    """

    arp = create_arp_db(session=session, arp_in=arp_in)
    return arp


@router.put("/{id}", response_model=ArpPublic)
def update_arp(
    *, session: SessionDep, current_user: CurrentUser, id: int, arp_in: ArpUpdate
) -> Any:
    """
    Update an arp.
    """
    arp_db = session.get(Arp, id)
    if not arp_db:
        raise HTTPException(status_code=404, detail="Arp not found")
    arp = update_arp_db(session=session, arp_db=arp_db, arp_in=arp_in)

    return arp


@router.delete("/{id}")
def delete_arp(session: SessionDep, current_user: CurrentUser, id: int) -> Message:
    """
    Delete an arp.
    """
    arp = session.get(Arp, id)
    if not arp:
        raise HTTPException(status_code=404, detail="Arp not found")
    delete_arp_db(session=session, arp_db=arp)
    return Message(message="Arp deleted successfully")
