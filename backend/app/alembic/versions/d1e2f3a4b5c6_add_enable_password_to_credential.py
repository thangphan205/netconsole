"""add enable_password to credential

Revision ID: d1e2f3a4b5c6
Revises: c1d2e3f4a5b6
Create Date: 2026-05-16

"""
from alembic import op
import sqlalchemy as sa


revision = "d1e2f3a4b5c6"
down_revision = "c1d2e3f4a5b6"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "credential",
        sa.Column("enable_password", sa.String(), nullable=True),
    )


def downgrade():
    op.drop_column("credential", "enable_password")
