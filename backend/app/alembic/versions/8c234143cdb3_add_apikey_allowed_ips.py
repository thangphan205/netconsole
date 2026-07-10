"""add apikey allowed_ips

Revision ID: 8c234143cdb3
Revises: a7b8c9d0e1f2
Create Date: 2026-07-10

"""
from alembic import op
import sqlalchemy as sa

revision = "8c234143cdb3"
down_revision = "a7b8c9d0e1f2"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "apikey",
        sa.Column(
            "allowed_ips", sa.String(), nullable=False, server_default="0.0.0.0/0"
        ),
    )


def downgrade():
    op.drop_column("apikey", "allowed_ips")
