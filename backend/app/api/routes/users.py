from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.sql.expression import or_
from sqlmodel import col, delete, func, select

from app.api.deps import (
    CurrentUser,
    SessionDep,
    get_current_active_superuser,
)
from app.core.config import settings
from app.core.security import get_password_hash, verify_password
from app.crud import users
from app.crud.audit import write_audit_log
from app.models import (
    Item,
    Message,
    OAuthAccount,
    UpdatePassword,
    User,
    UserCreate,
    UserPublic,
    UserRegister,
    UsersPublic,
    UserUpdate,
    UserUpdateMe,
    WebAuthnCredential,
)
from app.utils import generate_new_account_email, send_email

router = APIRouter()


@router.get(
    "/",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=UsersPublic,
)
def read_users(
    session: SessionDep, skip: int = 0, limit: int = 100, search: str = ""
) -> Any:
    """
    Retrieve users.
    """

    count_statement = (
        select(func.count())
        .select_from(User)
        .filter(
            or_(
                col(User.email).contains(search),
                col(User.full_name).contains(search),
            )
        )
    )
    count = session.exec(count_statement).one()

    statement = (
        select(User)
        .filter(
            or_(
                col(User.email).contains(search),
                col(User.full_name).contains(search),
            )
        )
        .offset(skip)
        .limit(limit)
    )
    user_rows = session.exec(statement).all()
    user_ids = [u.id for u in user_rows]

    # Batch-fetch OAuth accounts and passkeys for all returned users
    oauth_rows = session.exec(
        select(OAuthAccount.user_id, OAuthAccount.provider).where(
            col(OAuthAccount.user_id).in_(user_ids)
        )
    ).all()
    passkey_user_ids = set(
        session.exec(
            select(WebAuthnCredential.user_id).where(
                col(WebAuthnCredential.user_id).in_(user_ids)
            )
        ).all()
    )

    # Build per-user auth-method sets
    oauth_map: dict[int, list[str]] = {}
    for uid, provider in oauth_rows:
        oauth_map.setdefault(uid, []).append(provider)

    def _auth_methods(user: User) -> list[str]:
        uid: int = user.id  # type: ignore[assignment]
        methods: list[str] = []
        if user.hashed_password and user.password_login_enabled:
            methods.append("password")
        methods.extend(oauth_map.get(uid, []))
        if uid in passkey_user_ids:
            methods.append("passkey")
        return methods

    data = [
        UserPublic.model_validate({**u.model_dump(), "auth_methods": _auth_methods(u)})
        for u in user_rows
    ]
    return UsersPublic(data=data, count=count)


@router.post(
    "/", dependencies=[Depends(get_current_active_superuser)], response_model=UserPublic
)
def create_user(
    *,
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    user_in: UserCreate,
) -> Any:
    """
    Create new user.
    """
    user = users.get_user_by_email(session=session, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system.",
        )

    user = users.create_user(session=session, user_create=user_in)
    if settings.emails_enabled and user_in.email:
        email_data = generate_new_account_email(
            email_to=user_in.email, username=user_in.email, password=user_in.password
        )
        send_email(
            email_to=user_in.email,
            subject=email_data.subject,
            html_content=email_data.html_content,
        )
    write_audit_log(
        session,
        username=current_user.email,
        action="create_user",
        client_ip=request.client.host if request.client else "",
        message=f"Created user {user_in.email}",
    )
    return user


@router.patch("/me", response_model=UserPublic)
def update_user_me(
    *,
    request: Request,
    session: SessionDep,
    user_in: UserUpdateMe,
    current_user: CurrentUser,
) -> Any:
    """
    Update own user.
    """

    if user_in.email:
        existing_user = users.get_user_by_email(session=session, email=user_in.email)
        if existing_user and existing_user.id != current_user.id:
            raise HTTPException(
                status_code=409, detail="User with this email already exists"
            )
    user_data = user_in.model_dump(exclude_unset=True)
    current_user.sqlmodel_update(user_data)
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    write_audit_log(
        session,
        username=current_user.email,
        action="update_user_me",
        client_ip=request.client.host if request.client else "",
        message="Updated own profile",
    )
    return current_user


@router.patch("/me/password", response_model=Message)
def update_password_me(
    *,
    request: Request,
    session: SessionDep,
    body: UpdatePassword,
    current_user: CurrentUser,
) -> Any:
    """
    Update own password.
    """
    if not current_user.hashed_password or not verify_password(
        body.current_password, current_user.hashed_password
    ):
        raise HTTPException(status_code=400, detail="Incorrect password")
    if body.current_password == body.new_password:
        raise HTTPException(
            status_code=400, detail="New password cannot be the same as the current one"
        )
    hashed_password = get_password_hash(body.new_password)
    current_user.hashed_password = hashed_password
    session.add(current_user)
    session.commit()
    write_audit_log(
        session,
        username=current_user.email,
        action="change_password",
        client_ip=request.client.host if request.client else "",
        message="Changed own password",
    )
    return Message(message="Password updated successfully")


@router.get("/me", response_model=UserPublic)
def read_user_me(current_user: CurrentUser) -> Any:
    """
    Get current user.
    """
    return current_user


@router.delete("/me", response_model=Message)
def delete_user_me(
    request: Request, session: SessionDep, current_user: CurrentUser
) -> Any:
    """
    Delete own user.
    """
    if current_user.is_superuser:
        raise HTTPException(
            status_code=403, detail="Super users are not allowed to delete themselves"
        )
    email = current_user.email
    statement = delete(Item).where(col(Item.owner_id) == current_user.id)
    session.exec(statement)
    session.delete(current_user)
    session.commit()
    write_audit_log(
        session,
        username=email,
        action="delete_user_me",
        client_ip=request.client.host if request.client else "",
        message="Deleted own account",
        severity="WARNING",
    )
    return Message(message="User deleted successfully")


@router.post("/signup", response_model=UserPublic)
def register_user(session: SessionDep, user_in: UserRegister) -> Any:
    """
    Create new user without the need to be logged in.
    """
    if not settings.USERS_OPEN_REGISTRATION:
        raise HTTPException(
            status_code=403,
            detail="Open user registration is forbidden on this server",
        )
    user = users.get_user_by_email(session=session, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system",
        )
    user_create = UserCreate.model_validate(user_in)
    user = users.create_user(session=session, user_create=user_create)
    return user


@router.get("/{user_id}", response_model=UserPublic)
def read_user_by_id(
    user_id: int, session: SessionDep, current_user: CurrentUser
) -> Any:
    """
    Get a specific user by id.
    """
    user = session.get(User, user_id)
    if user == current_user:
        return user
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403,
            detail="The user doesn't have enough privileges",
        )
    return user


@router.patch(
    "/{user_id}",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=UserPublic,
)
def update_user(
    *,
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    user_id: int,
    user_in: UserUpdate,
) -> Any:
    """
    Update a user.
    """

    db_user = session.get(User, user_id)
    if not db_user:
        raise HTTPException(
            status_code=404,
            detail="The user with this id does not exist in the system",
        )
    if user_in.email:
        existing_user = users.get_user_by_email(session=session, email=user_in.email)
        if existing_user and existing_user.id != user_id:
            raise HTTPException(
                status_code=409, detail="User with this email already exists"
            )

    db_user = users.update_user(session=session, db_user=db_user, user_in=user_in)
    write_audit_log(
        session,
        username=current_user.email,
        action="update_user",
        client_ip=request.client.host if request.client else "",
        message=f"Updated user {db_user.email}",
    )
    return db_user


@router.delete("/{user_id}", dependencies=[Depends(get_current_active_superuser)])
def delete_user(
    request: Request, session: SessionDep, current_user: CurrentUser, user_id: int
) -> Message:
    """
    Delete a user.
    """
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user == current_user:
        raise HTTPException(
            status_code=403, detail="Super users are not allowed to delete themselves"
        )
    email = user.email
    statement = delete(Item).where(col(Item.owner_id) == user_id)
    session.exec(statement)
    session.delete(user)
    session.commit()
    write_audit_log(
        session,
        username=current_user.email,
        action="delete_user",
        client_ip=request.client.host if request.client else "",
        message=f"Deleted user {email}",
        severity="WARNING",
    )
    return Message(message="User deleted successfully")
