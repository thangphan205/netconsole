"""add health_status to switch

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-05-17

"""
from alembic import op
import sqlalchemy as sa

revision = "e2f3a4b5c6d7"
down_revision = "d1e2f3a4b5c6"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("switch", sa.Column("health_status", sa.String(), nullable=True))


def downgrade():
    op.drop_column("switch", "health_status")
