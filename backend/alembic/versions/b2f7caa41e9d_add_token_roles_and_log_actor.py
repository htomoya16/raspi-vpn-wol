"""add token role and log actor fields

Revision ID: b2f7caa41e9d
Revises: 8c9f3f7c1d21
Create Date: 2026-03-02 11:20:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b2f7caa41e9d"
down_revision: Union[str, Sequence[str], None] = "8c9f3f7c1d21"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("api_tokens") as batch_op:
        batch_op.add_column(
            sa.Column(
                "role",
                sa.Text(),
                nullable=False,
                server_default="admin",
            )
        )
    op.create_index(
        "idx_api_tokens_role_revoked_expires",
        "api_tokens",
        ["role", "revoked_at", "expires_at"],
        unique=False,
    )

    with op.batch_alter_table("logs") as batch_op:
        batch_op.add_column(sa.Column("api_token_id", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("actor_label", sa.Text(), nullable=True))
    op.create_index("idx_logs_api_token_id_id_desc", "logs", ["api_token_id", "id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("idx_logs_api_token_id_id_desc", table_name="logs")
    with op.batch_alter_table("logs") as batch_op:
        batch_op.drop_column("actor_label")
        batch_op.drop_column("api_token_id")

    op.drop_index("idx_api_tokens_role_revoked_expires", table_name="api_tokens")
    with op.batch_alter_table("api_tokens") as batch_op:
        batch_op.drop_column("role")
