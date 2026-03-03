"""add api_tokens table

Revision ID: 8c9f3f7c1d21
Revises: 411d4048d5f8
Create Date: 2026-03-02 01:35:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8c9f3f7c1d21"
down_revision: Union[str, Sequence[str], None] = "411d4048d5f8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "api_tokens",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column("token_prefix", sa.Text(), nullable=False),
        sa.Column("created_at", sa.Text(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("expires_at", sa.Text(), nullable=True),
        sa.Column("last_used_at", sa.Text(), nullable=True),
        sa.Column("revoked_at", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("uq_api_tokens_token_hash", "api_tokens", ["token_hash"], unique=True)
    op.create_index("idx_api_tokens_name", "api_tokens", ["name"], unique=False)
    op.create_index("idx_api_tokens_revoked_expires", "api_tokens", ["revoked_at", "expires_at"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("idx_api_tokens_revoked_expires", table_name="api_tokens")
    op.drop_index("idx_api_tokens_name", table_name="api_tokens")
    op.drop_index("uq_api_tokens_token_hash", table_name="api_tokens")
    op.drop_table("api_tokens")
