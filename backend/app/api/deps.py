from collections.abc import Generator
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import APIKeyHeader, OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from pydantic import ValidationError
from sqlmodel import Session

from app.core import security
from app.core.config import settings
from app.core.db import engine
from app.crud.api_keys import authenticate_api_key, ip_allowed, touch_last_used
from app.models import TokenPayload, User

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/login/access-token", auto_error=False
)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def get_db() -> Generator[Session]:
    with Session(engine) as session:
        yield session


def get_client_ip(request: Request) -> str:
    """Resolve the real client IP, accounting for the Traefik reverse proxy
    this app runs behind in production (docker-compose.traefik.yml) — without
    this, request.client.host would resolve to Traefik's docker-network peer
    address rather than the caller's real IP."""
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else ""


SessionDep = Annotated[Session, Depends(get_db)]
TokenDep = Annotated[str | None, Depends(reusable_oauth2)]
ApiKeyDep = Annotated[str | None, Depends(api_key_header)]


def get_current_user(
    session: SessionDep, request: Request, token: TokenDep, api_key: ApiKeyDep
) -> User:
    if api_key:
        db_key = authenticate_api_key(session, api_key)
        if not db_key:
            raise HTTPException(status_code=401, detail="Invalid or expired API key")
        user = session.get(User, db_key.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if not user.is_active:
            raise HTTPException(status_code=400, detail="Inactive user")
        client_ip = get_client_ip(request)
        if not ip_allowed(db_key.allowed_ips, client_ip):
            raise HTTPException(
                status_code=403, detail="API key not permitted from this IP address"
            )
        touch_last_used(session, db_key)
        if db_key.role == "read_only" and request.method not in (
            "GET",
            "HEAD",
            "OPTIONS",
        ):
            raise HTTPException(status_code=403, detail="This API key is read-only")
        return user

    if token:
        try:
            payload = jwt.decode(
                token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
            )
            token_data = TokenPayload(**payload)
        except (InvalidTokenError, ValidationError):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Could not validate credentials",
            )
        user = session.get(User, token_data.sub)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if not user.is_active:
            raise HTTPException(status_code=400, detail="Inactive user")
        return user

    raise HTTPException(status_code=401, detail="Not authenticated")


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_current_active_superuser(current_user: CurrentUser) -> User:
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403, detail="The user doesn't have enough privileges"
        )
    return current_user
