"""add compliance tables

Revision ID: c5d6e7f8a9b0
Revises: b9d0e1f2a3c4
Create Date: 2026-07-19

"""
import sqlalchemy as sa
from alembic import op

revision = "c5d6e7f8a9b0"
down_revision = "b9d0e1f2a3c4"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "complianceprofile",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("group_id", sa.Integer(), sa.ForeignKey("group.id"), nullable=True),
        sa.Column("ntp_server", sa.String(), nullable=True),
        sa.Column("syslog_server", sa.String(), nullable=True),
        sa.Column("dns_server", sa.String(), nullable=True),
        sa.Column("password_min_length", sa.Integer(), nullable=True),
        sa.Column("exec_timeout_minutes", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_complianceprofile_group_id", "complianceprofile", ["group_id"]
    )
    # One profile per group.
    op.create_index(
        "uq_complianceprofile_group_id_notnull",
        "complianceprofile",
        ["group_id"],
        unique=True,
        postgresql_where=sa.text("group_id IS NOT NULL"),
    )
    # At most one global (group_id IS NULL) profile.
    op.execute(
        "CREATE UNIQUE INDEX uq_complianceprofile_global "
        "ON complianceprofile ((1)) WHERE group_id IS NULL"
    )

    op.create_table(
        "compliancerun",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("switch_id", sa.Integer(), sa.ForeignKey("switch.id"), nullable=False),
        sa.Column("platform", sa.String(), nullable=False, server_default=""),
        sa.Column("username", sa.String(), nullable=False, server_default=""),
        sa.Column("status", sa.String(), nullable=False, server_default="completed"),
        sa.Column("error", sa.String(), nullable=False, server_default=""),
        sa.Column("profile_snapshot", sa.String(), nullable=False, server_default=""),
        sa.Column("passed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("skipped_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_compliancerun_switch_id", "compliancerun", ["switch_id"])
    op.create_index("ix_compliancerun_created_at", "compliancerun", ["created_at"])

    op.create_table(
        "complianceresult",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "run_id", sa.Integer(), sa.ForeignKey("compliancerun.id"), nullable=False
        ),
        sa.Column("rule_id", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default=""),
        sa.Column("evidence", sa.String(), nullable=False, server_default=""),
        sa.Column(
            "remediation_commands", sa.String(), nullable=False, server_default=""
        ),
    )
    op.create_index("ix_complianceresult_run_id", "complianceresult", ["run_id"])
    op.create_index("ix_complianceresult_rule_id", "complianceresult", ["rule_id"])


def downgrade():
    op.drop_table("complianceresult")
    op.drop_table("compliancerun")
    op.drop_table("complianceprofile")
