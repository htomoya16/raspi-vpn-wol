"""add logs event_kind

Revision ID: 411d4048d5f8
Revises: 3f2a6df9d4a1
Create Date: 2026-03-01 06:33:09.537859

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '411d4048d5f8'
down_revision: Union[str, Sequence[str], None] = '3f2a6df9d4a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("logs") as batch_op:
        batch_op.add_column(
            sa.Column(
                "event_kind",
                sa.Text(),
                nullable=False,
                server_default="normal",
            )
        )

    op.execute(
        sa.text(
            """
            UPDATE logs
            SET event_kind = 'periodic_status'
            WHERE action = 'seed_status'
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE logs
            SET action = 'status'
            WHERE action = 'seed_status'
            """
        )
    )
    op.create_index("idx_logs_event_kind_id_desc", "logs", ["event_kind", "id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("idx_logs_event_kind_id_desc", table_name="logs")
    with op.batch_alter_table("logs") as batch_op:
        batch_op.drop_column("event_kind")
