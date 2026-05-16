from typing import Any
from fastapi import APIRouter, HTTPException, Request
from app.api.deps import CurrentUser, SessionDep
from app.crud.audit import write_audit_log
from app.models import (
    Credential,
    CredentialCreate,
    CredentialPublic,
    CredentialsPublic,
    CredentialUpdate,
    Message,
)

from app.crud.credentials import (
    get_credentials,
    get_credentials_count,
    create_credential as create_credential_db,
    update_credential as update_credential_db,
    delete_credential as delete_credential_db,
)

router = APIRouter()


@router.get("/", response_model=CredentialsPublic)
def read_credentials(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 200,
    search: str = "",
) -> Any:
    """
    Retrieve credentials.
    """

    credentials = get_credentials(
        session=session,
        skip=skip,
        limit=limit,
        search=search,
    )
    count = get_credentials_count(
        session=session,
        skip=skip,
        limit=limit,
        search=search,
    )

    return CredentialsPublic(data=credentials, count=count)


@router.get("/{id}", response_model=CredentialPublic)
def read_credential(session: SessionDep, current_user: CurrentUser, id: int) -> Any:
    """
    Get credential by ID.
    """
    credential = session.get(Credential, id)
    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")
    return credential


@router.post("/")
def create_credential(
    *, request: Request, session: SessionDep, current_user: CurrentUser, credential_in: CredentialCreate
) -> Any:
    """
    Create new credential.
    """
    credential = create_credential_db(session=session, credential_in=credential_in)
    write_audit_log(session, username=current_user.email, action="create_credential",
                    client_ip=request.client.host if request.client else "",
                    message=f"Created credential {credential_in.username}")
    return credential


@router.put("/{id}", response_model=CredentialPublic)
def update_credential(
    *,
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    id: int,
    credential_in: CredentialUpdate
) -> Any:
    """
    Update an credential.
    """
    credential_db = session.get(Credential, id)
    if not credential_db:
        raise HTTPException(status_code=404, detail="Credential not found")
    credential = update_credential_db(
        session=session, credential_db=credential_db, credential_in=credential_in
    )
    write_audit_log(session, username=current_user.email, action="update_credential",
                    client_ip=request.client.host if request.client else "",
                    message=f"Updated credential {credential_db.username}")
    return credential


@router.delete("/{id}")
def delete_credential(
    request: Request, session: SessionDep, current_user: CurrentUser, id: int
) -> Message:
    """
    Delete an credential.
    """
    credential = session.get(Credential, id)
    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")
    username = credential.username
    delete_credential_db(session=session, credential_db=credential)
    write_audit_log(session, username=current_user.email, action="delete_credential",
                    client_ip=request.client.host if request.client else "",
                    message=f"Deleted credential {username}", severity="WARNING")
    return Message(message="Credential deleted successfully")
