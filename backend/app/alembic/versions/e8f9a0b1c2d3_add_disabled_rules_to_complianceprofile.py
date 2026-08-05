"""add disabled_rules to complianceprofile

Revision ID: e8f9a0b1c2d3
Revises: d6e7f8a9b0c1
Create Date: 2026-08-05

"""
import sqlalchemy as sa
from alembic import op

revision = "e8f9a0b1c2d3"
down_revision = "d6e7f8a9b0c1"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "complianceprofile",
        sa.Column("disabled_rules", sa.String(), nullable=True),
    )


def downgrade():
    op.drop_column("complianceprofile", "disabled_rules")
