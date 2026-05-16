from typing import Any

from fastapi import APIRouter, HTTPException, Request

from app.api.deps import CurrentUser, SessionDep
from app.crud.audit import write_audit_log
from app.crud.groups import (
    create_group as create_group_db,
)
from app.crud.groups import (
    delete_group as delete_group_db,
)
from app.crud.groups import (
    get_group_by_name,
    get_groups,
    get_groups_count,
)
from app.crud.groups import (
    update_group as update_group_db,
)
from app.models import (
    Group,
    GroupCreate,
    GroupPublic,
    GroupsPublic,
    GroupUpdate,
    Message,
)

router = APIRouter()


@router.get("/", response_model=GroupsPublic)
def read_groups(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 200,
    search: str = "",
) -> Any:
    """
    Retrieve groups.
    """

    groups = get_groups(
        session=session,
        skip=skip,
        limit=limit,
        search=search,
    )
    count = get_groups_count(
        session=session,
        skip=skip,
        limit=limit,
        search=search,
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


@router.post("/", response_model=GroupPublic)
def create_group(
    *,
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    group_in: GroupCreate,
) -> Any:
    """
    Create new group.
    """
    if not (group_in.name.isalnum() or "_" in group_in.name):
        raise HTTPException(status_code=400, detail="group name has [a-zA-Z0-9_] only")
    if not (group_in.site.isalnum() or "_" in group_in.site):
        raise HTTPException(status_code=400, detail="group site has [a-zA-Z0-9_] only")

    group_db = get_group_by_name(session=session, name=group_in.name)
    if group_db:
        raise HTTPException(status_code=400, detail="Group already exists")
    group = create_group_db(session=session, group_in=group_in)
    write_audit_log(
        session,
        username=current_user.email,
        action="create_group",
        client_ip=request.client.host if request.client else "",
        message=f"Created group {group_in.name}",
    )
    return group


@router.put("/{id}", response_model=GroupPublic)
def update_group(
    *,
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    id: int,
    group_in: GroupUpdate,
) -> Any:
    """
    Update an group.
    """
    group_db = session.get(Group, id)
    if not group_db:
        raise HTTPException(status_code=404, detail="Group not found")
    group = update_group_db(session=session, group_db=group_db, group_in=group_in)
    write_audit_log(
        session,
        username=current_user.email,
        action="update_group",
        client_ip=request.client.host if request.client else "",
        message=f"Updated group {group_db.name}",
    )
    return group


@router.delete("/{id}", response_model=Message)
def delete_group(
    request: Request, session: SessionDep, current_user: CurrentUser, id: int
) -> Message:
    """
    Delete an group.
    """
    group = session.get(Group, id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    name = group.name
    delete_group_db(session=session, group_db=group)
    write_audit_log(
        session,
        username=current_user.email,
        action="delete_group",
        client_ip=request.client.host if request.client else "",
        message=f"Deleted group {name}",
        severity="WARNING",
    )
    return Message(message="Group deleted successfully")
