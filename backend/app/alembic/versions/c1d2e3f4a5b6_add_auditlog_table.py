"""add auditlog table

Revision ID: c1d2e3f4a5b6
Revises: b4c5d6e7f8a9
Create Date: 2026-05-16

"""
from alembic import op
import sqlalchemy as sa


revision = "c1d2e3f4a5b6"
down_revision = "b4c5d6e7f8a9"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "auditlog",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "timestamp",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("severity", sa.String(), nullable=False, server_default="INFO"),
        sa.Column("username", sa.String(), nullable=False),
        sa.Column("client_ip", sa.String(), nullable=False, server_default=""),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("message", sa.String(), nullable=False, server_default=""),
    )
    op.create_index("ix_auditlog_timestamp", "auditlog", ["timestamp"])
    op.create_index("ix_auditlog_username", "auditlog", ["username"])
    op.create_index("ix_auditlog_action", "auditlog", ["action"])
    op.create_index("ix_auditlog_severity", "auditlog", ["severity"])


def downgrade():
    op.drop_table("auditlog")
