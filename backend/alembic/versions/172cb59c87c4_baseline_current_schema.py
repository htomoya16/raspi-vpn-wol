"""baseline current schema

Revision ID: 172cb59c87c4
Revises: 
Create Date: 2026-02-28 23:24:19.268991

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '172cb59c87c4'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "pcs",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("mac_address", sa.Text(), nullable=False),
        sa.Column("ip_address", sa.Text(), nullable=True),
        sa.Column("tags_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default="unknown"),
        sa.Column("last_seen_at", sa.Text(), nullable=True),
        sa.Column("broadcast_ip", sa.Text(), nullable=True),
        sa.Column("send_interface", sa.Text(), nullable=False, server_default="eth0"),
        sa.Column("wol_port", sa.Integer(), nullable=False, server_default="9"),
        sa.Column("status_method", sa.Text(), nullable=False, server_default="tcp"),
        sa.Column("status_port", sa.Integer(), nullable=False, server_default="445"),
        sa.Column("created_at", sa.Text(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.Text(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "jobs",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("job_type", sa.Text(), nullable=False),
        sa.Column("state", sa.Text(), nullable=False),
        sa.Column("payload_json", sa.Text(), nullable=True),
        sa.Column("result_json", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("started_at", sa.Text(), nullable=True),
        sa.Column("finished_at", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.Text(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("pc_id", sa.Text(), nullable=True),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("ok", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("error_code", sa.Text(), nullable=True),
        sa.Column("details_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["pc_id"], ["pcs.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "status_history",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("pc_id", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("is_online", sa.Integer(), nullable=False),
        sa.Column("changed_at", sa.Text(), nullable=False),
        sa.Column("source", sa.Text(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.CheckConstraint("is_online IN (0, 1)", name="ck_status_history_is_online"),
        sa.ForeignKeyConstraint(["pc_id"], ["pcs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "uptime_daily_summary",
        sa.Column("pc_id", sa.Text(), nullable=False),
        sa.Column("date", sa.Text(), nullable=False),
        sa.Column("tz", sa.Text(), nullable=False, server_default="Asia/Tokyo"),
        sa.Column("online_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("online_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("offline_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("first_online_at", sa.Text(), nullable=True),
        sa.Column("last_online_at", sa.Text(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.Text(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.CheckConstraint("online_seconds BETWEEN 0 AND 86400", name="ck_uptime_daily_summary_online_seconds"),
        sa.ForeignKeyConstraint(["pc_id"], ["pcs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("pc_id", "date", "tz"),
    )

    op.create_index("uq_pcs_mac_address", "pcs", ["mac_address"], unique=True)
    op.create_index("idx_pcs_status_id", "pcs", ["status", "id"], unique=False)
    op.create_index("idx_logs_pc_id_desc", "logs", ["pc_id", "id"], unique=False)
    op.create_index("idx_logs_action_id_desc", "logs", ["action", "id"], unique=False)
    op.create_index("idx_logs_ok_id_desc", "logs", ["ok", "id"], unique=False)
    op.create_index("idx_logs_created_at", "logs", ["created_at"], unique=False)
    op.create_index(
        "idx_jobs_job_type_state_created_at",
        "jobs",
        ["job_type", "state", "created_at"],
        unique=False,
    )
    op.create_index(
        "idx_status_history_pc_changed_id",
        "status_history",
        ["pc_id", "changed_at", "id"],
        unique=False,
    )
    op.create_index(
        "idx_status_history_changed_at",
        "status_history",
        ["changed_at"],
        unique=False,
    )
    op.create_index(
        "idx_uptime_daily_summary_pc_tz_date",
        "uptime_daily_summary",
        ["pc_id", "tz", "date"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("idx_uptime_daily_summary_pc_tz_date", table_name="uptime_daily_summary")
    op.drop_index("idx_status_history_changed_at", table_name="status_history")
    op.drop_index("idx_status_history_pc_changed_id", table_name="status_history")
    op.drop_index("idx_jobs_job_type_state_created_at", table_name="jobs")
    op.drop_index("idx_logs_created_at", table_name="logs")
    op.drop_index("idx_logs_ok_id_desc", table_name="logs")
    op.drop_index("idx_logs_action_id_desc", table_name="logs")
    op.drop_index("idx_logs_pc_id_desc", table_name="logs")
    op.drop_index("idx_pcs_status_id", table_name="pcs")
    op.drop_index("uq_pcs_mac_address", table_name="pcs")

    op.drop_table("uptime_daily_summary")
    op.drop_table("status_history")
    op.drop_table("logs")
    op.drop_table("jobs")
    op.drop_table("pcs")
