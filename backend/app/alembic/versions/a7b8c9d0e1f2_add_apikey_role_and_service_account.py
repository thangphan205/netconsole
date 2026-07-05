"""add apikey role and user is_service_account

Revision ID: a7b8c9d0e1f2
Revises: f4a5b6c7d8e9
Create Date: 2026-07-05

"""
from alembic import op
import sqlalchemy as sa

revision = "a7b8c9d0e1f2"
down_revision = "f4a5b6c7d8e9"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "apikey",
        sa.Column(
            "role", sa.String(), nullable=False, server_default="read_write"
        ),
    )
    op.add_column(
        "user",
        sa.Column(
            "is_service_account",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade():
    op.drop_column("user", "is_service_account")
    op.drop_column("apikey", "role")
