"""require pcs.ip_address

Revision ID: 3f2a6df9d4a1
Revises: 179843b619e7
Create Date: 2026-03-01 00:20:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "3f2a6df9d4a1"
down_revision: Union[str, Sequence[str], None] = "179843b619e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    missing_count = bind.execute(
        sa.text("SELECT COUNT(*) FROM pcs WHERE ip_address IS NULL OR trim(ip_address) = ''")
    ).scalar_one()
    if int(missing_count) > 0:
        raise RuntimeError(
            "pcs.ip_address must be populated before upgrading to 3f2a6df9d4a1. "
            "Update/delete rows with NULL/empty ip_address, then rerun migration."
        )

    with op.batch_alter_table("pcs") as batch_op:
        batch_op.alter_column(
            "ip_address",
            existing_type=sa.Text(),
            nullable=False,
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("pcs") as batch_op:
        batch_op.alter_column(
            "ip_address",
            existing_type=sa.Text(),
            nullable=True,
        )
