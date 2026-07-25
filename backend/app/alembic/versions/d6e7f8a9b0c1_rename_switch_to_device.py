"""rename switch to device

Revision ID: d6e7f8a9b0c1
Revises: c5d6e7f8a9b0
Create Date: 2026-07-25

"""
from alembic import op

revision = "d6e7f8a9b0c1"
down_revision = "c5d6e7f8a9b0"
branch_labels = None
depends_on = None

# (table, old_column, new_column)
_COLUMN_RENAMES = [
    ("interface", "switch_id", "device_id"),
    ("macaddress", "switch_id", "device_id"),
    ("arp", "switch_id", "device_id"),
    ("ipinterface", "switch_id", "device_id"),
    ("configrevision", "switch_id", "device_id"),
    ("compliancerun", "switch_id", "device_id"),
]

# (old_index_name, new_index_name)
_INDEX_RENAMES = [
    ("ix_switch_hostname", "ix_device_hostname"),
    ("ix_interface_switch_id", "ix_interface_device_id"),
    ("ix_configrevision_switch_id", "ix_configrevision_device_id"),
    ("ix_compliancerun_switch_id", "ix_compliancerun_device_id"),
]

# (table, old_constraint_name, new_constraint_name) - Postgres's default
# auto-generated names for unnamed PK/FK constraints. Wrapped in a DO block
# below since Postgres has no "RENAME CONSTRAINT IF EXISTS".
_CONSTRAINT_RENAMES = [
    ("device", "switch_pkey", "device_pkey"),
    ("macaddress", "macaddress_switch_id_fkey", "macaddress_device_id_fkey"),
    ("arp", "arp_switch_id_fkey", "arp_device_id_fkey"),
    ("ipinterface", "ipinterface_switch_id_fkey", "ipinterface_device_id_fkey"),
    (
        "configrevision",
        "configrevision_switch_id_fkey",
        "configrevision_device_id_fkey",
    ),
    ("compliancerun", "compliancerun_switch_id_fkey", "compliancerun_device_id_fkey"),
]

_RENAME_CONSTRAINT_SQL = """
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '{old}') THEN
        ALTER TABLE {table} RENAME CONSTRAINT {old} TO {new};
    END IF;
END $$;
"""


def upgrade():
    op.rename_table("switch", "device")
    op.execute("ALTER SEQUENCE IF EXISTS switch_id_seq RENAME TO device_id_seq")

    for table, old_col, new_col in _COLUMN_RENAMES:
        op.alter_column(table, old_col, new_column_name=new_col)

    for old_idx, new_idx in _INDEX_RENAMES:
        op.execute(f"ALTER INDEX IF EXISTS {old_idx} RENAME TO {new_idx}")

    for table, old_name, new_name in _CONSTRAINT_RENAMES:
        op.execute(_RENAME_CONSTRAINT_SQL.format(table=table, old=old_name, new=new_name))


def downgrade():
    for table, old_name, new_name in _CONSTRAINT_RENAMES:
        op.execute(_RENAME_CONSTRAINT_SQL.format(table=table, old=new_name, new=old_name))

    for old_idx, new_idx in _INDEX_RENAMES:
        op.execute(f"ALTER INDEX IF EXISTS {new_idx} RENAME TO {old_idx}")

    for table, old_col, new_col in _COLUMN_RENAMES:
        op.alter_column(table, new_col, new_column_name=old_col)

    op.execute("ALTER SEQUENCE IF EXISTS device_id_seq RENAME TO switch_id_seq")
    op.rename_table("device", "switch")
