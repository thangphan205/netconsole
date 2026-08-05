"""add disabled_rules to device

Revision ID: f9a0b1c2d3e4
Revises: e8f9a0b1c2d3
Create Date: 2026-08-05

"""
import sqlalchemy as sa
from alembic import op

revision = "f9a0b1c2d3e4"
down_revision = "e8f9a0b1c2d3"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "device",
        sa.Column("disabled_rules", sa.String(), nullable=True),
    )


def downgrade():
    op.drop_column("device", "disabled_rules")
