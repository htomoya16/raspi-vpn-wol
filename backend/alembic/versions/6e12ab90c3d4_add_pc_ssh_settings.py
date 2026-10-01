"""PC別SSH設定を保存する。秘密鍵はDBに保存しない。"""

from alembic import op
import sqlalchemy as sa

revision = "6e12ab90c3d4"
down_revision = "b2f7caa41e9d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """SSH設定と接続確認結果のテーブルを追加する。"""
    op.create_table(
        "pc_ssh_settings",
        sa.Column("pc_id", sa.Text(), primary_key=True),
        sa.Column("username", sa.Text(), nullable=False),
        sa.Column("port", sa.Integer(), nullable=False, server_default="22"),
        sa.Column("enabled", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("key_id", sa.Text(), nullable=False, unique=True),
        sa.Column("host_key", sa.Text(), nullable=True),
        sa.Column("verified_ip", sa.Text(), nullable=True),
        sa.Column("verified_at", sa.Text(), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.ForeignKeyConstraint(["pc_id"], ["pcs.id"], ondelete="CASCADE"),
        sa.CheckConstraint("port BETWEEN 1 AND 65535"),
        sa.CheckConstraint("enabled IN (0, 1)"),
    )


def downgrade() -> None:
    """SSH設定テーブルを削除する。鍵ファイルは保持する。"""
    op.drop_table("pc_ssh_settings")
