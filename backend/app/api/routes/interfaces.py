from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
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
    session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 100
) -> Any:
    """
    Retrieve interfaces.
    """

    if current_user.is_superuser:
        count_statement = select(func.count()).select_from(Interface)
        count = session.exec(count_statement).one()
        statement = select(Interface).offset(skip).limit(limit)
        interfaces = session.exec(statement).all()
    else:
        count_statement = select(func.count()).select_from(Interface)
        count = session.exec(count_statement).one()
        statement = select(Interface).offset(skip).limit(limit)
        interfaces = session.exec(statement).all()

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
    interface = Interface.model_validate(interface_in)
    session.add(interface)
    session.commit()
    session.refresh(interface)
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
    interface = session.get(Interface, id)
    if not interface:
        raise HTTPException(status_code=404, detail="Interface not found")
    update_dict = interface_in.model_dump(exclude_unset=True)
    interface.sqlmodel_update(update_dict)
    session.add(interface)
    session.commit()
    session.refresh(interface)
    return interface


@router.delete("/{id}")
def delete_interface(
    session: SessionDep, current_user: CurrentUser, id: int
) -> Message:
    """
    Delete an interface.
    """
    interface = session.get(Interface, id)
    if not interface:
        raise HTTPException(status_code=404, detail="Interface not found")
    session.delete(interface)
    session.commit()
    return Message(message="Interface deleted successfully")
