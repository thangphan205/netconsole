"""add syslog_severity to complianceprofile

Revision ID: 48a528e5d66b
Revises: f9a0b1c2d3e4
Create Date: 2026-08-11

"""
import sqlalchemy as sa
from alembic import op

revision = "48a528e5d66b"
down_revision = "f9a0b1c2d3e4"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "complianceprofile",
        sa.Column("syslog_severity", sa.String(), nullable=True),
    )


def downgrade():
    op.drop_column("complianceprofile", "syslog_severity")
