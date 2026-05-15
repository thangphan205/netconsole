"""add social login and passkey

Revision ID: a3f1b2c4d5e6
Revises: f0418d9eea16
Create Date: 2026-05-15

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


revision = "a3f1b2c4d5e6"
down_revision = "f0418d9eea16"
branch_labels = None
depends_on = None


def upgrade():
    # Make hashed_password nullable (OAuth-only users have no password)
    op.alter_column(
        "user",
        "hashed_password",
        existing_type=sqlmodel.sql.sqltypes.AutoString(),
        nullable=True,
    )

    # OAuthAccount table
    op.create_table(
        "oauthaccount",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("provider", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("provider_user_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("provider_email", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("access_token", sa.Text(), nullable=True),
        sa.Column("refresh_token", sa.Text(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider", "provider_user_id", name="uq_oauthaccount_provider_sub"),
    )
    op.create_index("ix_oauthaccount_user_id", "oauthaccount", ["user_id"])
    op.create_index("ix_oauthaccount_provider", "oauthaccount", ["provider"])
    op.create_index("ix_oauthaccount_provider_user_id", "oauthaccount", ["provider_user_id"])

    # WebAuthnCredential table
    op.create_table(
        "webauthncredential",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("credential_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("public_key", sa.Text(), nullable=False),
        sa.Column("sign_count", sa.Integer(), nullable=False),
        sa.Column("device_type", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("backed_up", sa.Boolean(), nullable=False),
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("aaguid", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("credential_id", name="uq_webauthncredential_credential_id"),
    )
    op.create_index("ix_webauthncredential_user_id", "webauthncredential", ["user_id"])
    op.create_index("ix_webauthncredential_credential_id", "webauthncredential", ["credential_id"])


def downgrade():
    op.drop_index("ix_webauthncredential_credential_id", table_name="webauthncredential")
    op.drop_index("ix_webauthncredential_user_id", table_name="webauthncredential")
    op.drop_table("webauthncredential")

    op.drop_index("ix_oauthaccount_provider_user_id", table_name="oauthaccount")
    op.drop_index("ix_oauthaccount_provider", table_name="oauthaccount")
    op.drop_index("ix_oauthaccount_user_id", table_name="oauthaccount")
    op.drop_table("oauthaccount")

    op.alter_column(
        "user",
        "hashed_password",
        existing_type=sqlmodel.sql.sqltypes.AutoString(),
        nullable=False,
    )
