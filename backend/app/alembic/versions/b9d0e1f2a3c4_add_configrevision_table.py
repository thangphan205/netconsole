"""add configrevision table

Revision ID: b9d0e1f2a3c4
Revises: 8c234143cdb3
Create Date: 2026-07-18

"""
from alembic import op
import sqlalchemy as sa


revision = "b9d0e1f2a3c4"
down_revision = "8c234143cdb3"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "configrevision",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "switch_id",
            sa.Integer(),
            sa.ForeignKey("switch.id"),
            nullable=False,
        ),
        sa.Column("commit_hash", sa.String(), nullable=False),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("username", sa.String(), nullable=False, server_default=""),
        sa.Column("command_type", sa.String(), nullable=False, server_default=""),
        sa.Column("commands", sa.String(), nullable=False, server_default=""),
        sa.Column("message", sa.String(), nullable=False, server_default=""),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_configrevision_switch_id", "configrevision", ["switch_id"])
    op.create_index("ix_configrevision_commit_hash", "configrevision", ["commit_hash"])
    op.create_index("ix_configrevision_action", "configrevision", ["action"])
    op.create_index("ix_configrevision_created_at", "configrevision", ["created_at"])


def downgrade():
    op.drop_table("configrevision")
