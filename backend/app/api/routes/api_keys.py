from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request

from app.api.deps import CurrentUser, SessionDep, get_current_active_superuser
from app.crud.api_keys import (
    create_api_key as create_api_key_db,
)
from app.crud.api_keys import (
    get_api_key_by_id,
    get_api_keys,
    get_api_keys_count,
)
from app.crud.api_keys import (
    revoke_api_key as revoke_api_key_db,
)
from app.crud.audit import write_audit_log
from app.models import (
    ApiKeyCreate,
    ApiKeyCreateResponse,
    ApiKeysPublic,
    Message,
)

router = APIRouter(dependencies=[Depends(get_current_active_superuser)])


@router.post("/", response_model=ApiKeyCreateResponse)
def create_api_key(
    *,
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    key_in: ApiKeyCreate,
) -> Any:
    """
    Mint a new API key. The raw key is returned ONLY in this response.
    """
    api_key, raw_key = create_api_key_db(
        session=session, key_in=key_in, owner_id=current_user.id  # type: ignore[arg-type]
    )
    # Build the response before write_audit_log's commit, which expires
    # api_key's attributes and would otherwise make model_dump() return {}.
    response = ApiKeyCreateResponse(**api_key.model_dump(), key=raw_key)
    write_audit_log(
        session,
        username=current_user.email,
        action="create_api_key",
        client_ip=request.client.host if request.client else "",
        message=f"Created API key '{api_key.name}' for user_id={api_key.user_id}",
    )
    return response


@router.get("/", response_model=ApiKeysPublic)
def read_api_keys(session: SessionDep, skip: int = 0, limit: int = 200) -> Any:
    """
    Retrieve API keys (hashed_key is never returned).
    """
    return ApiKeysPublic(
        data=get_api_keys(session, skip, limit),
        count=get_api_keys_count(session),
    )


@router.delete("/{id}", response_model=Message)
def delete_api_key(
    request: Request, session: SessionDep, current_user: CurrentUser, id: int
) -> Message:
    """
    Revoke an API key.
    """
    api_key = get_api_key_by_id(session, id)
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")
    removed_user = revoke_api_key_db(session, api_key)
    message = f"Revoked API key id={id}"
    if removed_user:
        message += f"; removed orphaned service account user_id={removed_user.id}"
    write_audit_log(
        session,
        username=current_user.email,
        action="revoke_api_key",
        client_ip=request.client.host if request.client else "",
        message=message,
        severity="WARNING",
    )
    return Message(message="API key revoked")
