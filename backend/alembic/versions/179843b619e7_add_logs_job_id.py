"""add logs job_id

Revision ID: 179843b619e7
Revises: 172cb59c87c4
Create Date: 2026-02-28 23:25:15.735721

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '179843b619e7'
down_revision: Union[str, Sequence[str], None] = '172cb59c87c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("logs") as batch_op:
        batch_op.add_column(sa.Column("job_id", sa.Text(), nullable=True))

    op.create_index("idx_logs_job_id_id_desc", "logs", ["job_id", "id"], unique=False)
    op.execute(
        """
        UPDATE logs
        SET job_id = json_extract(details_json, '$.job_id')
        WHERE job_id IS NULL
          AND details_json IS NOT NULL
          AND json_valid(details_json) = 1
          AND json_type(json_extract(details_json, '$.job_id')) = 'text'
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("idx_logs_job_id_id_desc", table_name="logs")
    with op.batch_alter_table("logs") as batch_op:
        batch_op.drop_column("job_id")
