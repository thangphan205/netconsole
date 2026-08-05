"""add compliancemanualevidence table and is_manual to complianceresult

Revision ID: a1b2c3d4e5f6
Revises: f9a0b1c2d3e4
Create Date: 2026-08-05

"""
import sqlalchemy as sa
from alembic import op

revision = "a1b2c3d4e5f6"
down_revision = "f9a0b1c2d3e4"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "complianceresult",
        sa.Column(
            "is_manual", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
    )

    op.create_table(
        "compliancemanualevidence",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "device_id", sa.Integer(), sa.ForeignKey("device.id"), nullable=False
        ),
        sa.Column("rule_id", sa.String(), nullable=False),
        sa.Column("evidence", sa.String(), nullable=False),
        sa.Column("attested_by", sa.String(), nullable=False),
        sa.Column(
            "attested_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_compliancemanualevidence_device_id",
        "compliancemanualevidence",
        ["device_id"],
    )
    op.create_index(
        "ix_compliancemanualevidence_rule_id",
        "compliancemanualevidence",
        ["rule_id"],
    )
    op.create_unique_constraint(
        "uq_compliancemanualevidence_device_rule",
        "compliancemanualevidence",
        ["device_id", "rule_id"],
    )


def downgrade():
    op.drop_table("compliancemanualevidence")
    op.drop_column("complianceresult", "is_manual")
