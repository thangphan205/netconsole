"""add password_login_enabled to user

Revision ID: b4c5d6e7f8a9
Revises: a3f1b2c4d5e6
Create Date: 2026-05-15

"""
from alembic import op
import sqlalchemy as sa


revision = "b4c5d6e7f8a9"
down_revision = "a3f1b2c4d5e6"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "user",
        sa.Column(
            "password_login_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )


def downgrade():
    op.drop_column("user", "password_login_enabled")
