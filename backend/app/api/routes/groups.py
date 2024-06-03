from typing import Any
from fastapi import APIRouter, HTTPException
from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Group,
    GroupCreate,
    GroupPublic,
    GroupsPublic,
    GroupUpdate,
    Message,
)

from app.crud.groups import (
    get_groups,
    get_groups_count,
    get_group_by_name,
    create_group as create_group_db,
    update_group as update_group_db,
    delete_group as delete_group_db,
)

router = APIRouter()


@router.get("/", response_model=GroupsPublic)
def read_groups(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 500,
    ip: str = "",
    mac: str = "",
    interface: str = "",
    switch_id: int = 0,
) -> Any:
    """
    Retrieve groups.
    """

    groups = get_groups(
        session=session,
        skip=skip,
        limit=limit,
        ip=ip,
        mac=mac,
        interface=interface,
        switch_id=switch_id,
    )
    count = get_groups_count(
        session=session,
        skip=skip,
        limit=limit,
        ip=ip,
        mac=mac,
        interface=interface,
        switch_id=switch_id,
    )

    return GroupsPublic(data=groups, count=count)


@router.get("/{id}", response_model=GroupPublic)
def read_group(session: SessionDep, current_user: CurrentUser, id: int) -> Any:
    """
    Get group by ID.
    """
    group = session.get(Group, id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return group


@router.post("/")
def create_group(
    *, session: SessionDep, current_user: CurrentUser, group_in: GroupCreate
) -> Any:
    """
    Create new group.
    """
    group_db = get_group_by_name(session=session, name=group_in.name)
    if group_db:
        raise HTTPException(status_code=200, detail="Group exist!")
    group = create_group_db(session=session, group_in=group_in)
    return group


@router.put("/{id}", response_model=GroupPublic)
def update_group(
    *, session: SessionDep, current_user: CurrentUser, id: int, group_in: GroupUpdate
) -> Any:
    """
    Update an group.
    """
    group_db = session.get(Group, id)
    if not group_db:
        raise HTTPException(status_code=404, detail="Group not found")
    group = update_group_db(session=session, group_db=group_db, group_in=group_in)

    return group


@router.delete("/{id}")
def delete_group(session: SessionDep, current_user: CurrentUser, id: int) -> Message:
    """
    Delete an group.
    """
    group = session.get(Group, id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    delete_group_db(session=session, group_db=group)
    return Message(message="Group deleted successfully")
