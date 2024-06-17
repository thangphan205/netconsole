from typing import Any
from sqlmodel import Session, select, func
from sqlalchemy.sql.expression import or_
from app.models import Group, GroupCreate, GroupUpdate
from datetime import datetime
from app.crud.create_nornir import create_groups
from app.crud.switches import update_switch_delete_group


def get_groups(session: Session, skip: int, limit: int, search: str):

    statement = select(Group).filter(
        or_(
            Group.name.contains(search),
            Group.description.contains(search),
        )
    )
    groups = session.exec(statement.offset(skip).limit(limit)).all()
    return groups


def get_group_by_id(session: Session, id: int):

    group = session.get(Group, id)
    return group


def get_group_by_name(session: Session, name: str):

    statement = select(Group).where(Group.name == name)
    group = session.exec(statement).all()
    return group


def get_groups_count(session: Session, skip: int, limit: int, search: str):

    count_statement = (
        select(func.count())
        .select_from(Group)
        .filter(
            or_(
                Group.name.contains(search),
                Group.description.contains(search),
            )
        )
    )
    count = session.exec(count_statement).one()
    return count


def create_group(session: Session, group_in: GroupCreate) -> Group:

    group = Group.model_validate(group_in)
    session.add(group)
    session.commit()
    session.refresh(group)

    groups_db = session.exec(select(Group)).all()
    create_groups(groups_db=groups_db)
    return group


def update_group(*, session: Session, group_db: Group, group_in: GroupUpdate) -> Any:
    """
    Update an group.
    """

    update_dict = group_in.__dict__
    update_dict["updated_at"] = datetime.now()
    group_db.sqlmodel_update(update_dict)
    session.add(group_db)
    session.commit()
    session.refresh(group_db)

    groups_db = session.exec(select(Group)).all()
    create_groups(groups_db=groups_db)

    return group_db


def delete_group(session: Session, group_db: Group):

    session.delete(group_db)
    session.commit()

    update_switch_delete_group(session=session, group_name=group_db.name)
    groups_db = session.exec(select(Group)).all()
    create_groups(groups_db=groups_db)
    return True
