from datetime import datetime, timezone

from sqlmodel import Session, select

from app.models import OAuthAccount, User


def get_or_create_user_from_oauth(
    *,
    session: Session,
    provider: str,
    provider_user_id: str,
    email: str,
    full_name: str | None,
    access_token: str | None,
    refresh_token: str | None,
    expires_at: datetime | None,
) -> User:
    # 1. Existing OAuth account → return linked user
    existing_oauth = session.exec(
        select(OAuthAccount).where(
            OAuthAccount.provider == provider,
            OAuthAccount.provider_user_id == provider_user_id,
        )
    ).first()

    if existing_oauth:
        # Refresh tokens
        existing_oauth.access_token = access_token
        existing_oauth.refresh_token = refresh_token
        existing_oauth.expires_at = expires_at
        existing_oauth.updated_at = datetime.now(timezone.utc)
        session.add(existing_oauth)
        session.commit()
        session.refresh(existing_oauth)
        user = session.get(User, existing_oauth.user_id)
        assert user is not None
        return user

    # 2. Existing user by email → link OAuth account
    user = session.exec(select(User).where(User.email == email)).first()

    if not user:
        # 3. No user at all → create one (no password)
        user = User(
            email=email,
            full_name=full_name,
            is_active=True,
            is_superuser=False,
            hashed_password=None,
        )
        session.add(user)
        session.commit()
        session.refresh(user)

    # Create the OAuth account link
    oauth_account = OAuthAccount(
        user_id=user.id,
        provider=provider,
        provider_user_id=provider_user_id,
        provider_email=email,
        access_token=access_token,
        refresh_token=refresh_token,
        expires_at=expires_at,
    )
    session.add(oauth_account)
    session.commit()
    return user
