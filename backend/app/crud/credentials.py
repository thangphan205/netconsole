from typing import Any
from sqlmodel import Session, select, func, asc
from sqlalchemy.sql.expression import or_
from app.models import Credential, CredentialCreate, CredentialUpdate, Switch
from datetime import datetime


def get_credentials(
    session: Session,
    skip: int,
    limit: int,
    search: str = "",
):
    statement = (
        select(Credential)
        .filter(
            or_(
                Credential.username.contains(search),
            )
        )
        .order_by(asc(Credential.username))
    )
    credentials = session.exec(statement.offset(skip).limit(limit)).all()
    return credentials


def get_credentials_count(session: Session, skip: int, limit: int, search: str = ""):

    count_statement = (
        select(func.count())
        .select_from(Credential)
        .filter(
            or_(
                Credential.username.contains(search),
            )
        )
    )
    count = session.exec(count_statement).one()
    return count


def get_credential_by_id(session: Session, id: int):

    credential = session.get(Credential, id)
    return credential


def create_credential(session: Session, credential_in: CredentialCreate) -> Credential:

    credential = Credential.model_validate(credential_in)
    session.add(credential)
    session.commit()
    session.refresh(credential)

    return credential


def update_credential(
    *, session: Session, credential_db: Credential, credential_in: CredentialUpdate
) -> Any:
    """
    Update an credential.
    """

    update_dict = credential_in.__dict__
    update_dict["updated_at"] = datetime.now()
    credential_db.sqlmodel_update(update_dict)
    session.add(credential_db)
    session.commit()
    session.refresh(credential_db)

    return credential_db


def delete_credential(session: Session, credential_db: Credential):

    session.delete(credential_db)
    session.commit()
    return True
