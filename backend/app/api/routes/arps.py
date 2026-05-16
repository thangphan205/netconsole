from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUser, SessionDep
from app.crud.arps import (
    create_arp as create_arp_db,
)
from app.crud.arps import (
    delete_arp as delete_arp_db,
)
from app.crud.arps import (
    get_arps,
    get_arps_count,
)
from app.crud.arps import (
    update_arp as update_arp_db,
)
from app.models import (
    Arp,
    ArpCreate,
    ArpPublic,
    ArpsPublic,
    ArpUpdate,
    Message,
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
    since: datetime | None = None,
) -> Any:
    """
    Retrieve arps. Pass `since` (ISO datetime) to return only entries first seen after that time.
    """
    arps = get_arps(
        session=session,
        skip=skip,
        limit=limit,
        switch_id=switch_id,
        search=search,
        since=since,
    )
    count = get_arps_count(
        session=session,
        switch_id=switch_id,
        search=search,
        since=since,
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
    return create_arp_db(session=session, arp_in=arp_in)


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
    return update_arp_db(session=session, arp_db=arp_db, arp_in=arp_in)


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
