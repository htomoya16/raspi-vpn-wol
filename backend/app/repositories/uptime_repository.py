from __future__ import annotations

from typing import cast

from app.db.database import connection
from app.types import PcStatusHistoryRow, PcUptimeDailySummaryRow

STATUS_HISTORY_RETENTION_DAYS = 365


def get_latest_status_before(pc_id: str, changed_before: str) -> PcStatusHistoryRow | None:
    with connection() as conn:
        row = conn.execute(
            """
            SELECT
                id,
                pc_id,
                status,
                is_online,
                changed_at,
                source,
                note,
                created_at
            FROM status_history
            WHERE pc_id = ?
              AND datetime(changed_at) < datetime(?)
            ORDER BY datetime(changed_at) DESC, id DESC
            LIMIT 1
            """,
            (pc_id, changed_before),
        ).fetchone()
    if row is None:
        return None
    return cast(PcStatusHistoryRow, dict(row))


def list_status_history_between(
    pc_id: str,
    changed_from: str,
    changed_to: str,
) -> list[PcStatusHistoryRow]:
    with connection() as conn:
        rows = conn.execute(
            """
            SELECT
                id,
                pc_id,
                status,
                is_online,
                changed_at,
                source,
                note,
                created_at
            FROM status_history
            WHERE pc_id = ?
              AND datetime(changed_at) >= datetime(?)
              AND datetime(changed_at) < datetime(?)
            ORDER BY datetime(changed_at) ASC, id ASC
            """,
            (pc_id, changed_from, changed_to),
        ).fetchall()
    return [cast(PcStatusHistoryRow, dict(row)) for row in rows]


def insert_status_history(
    pc_id: str,
    status: str,
    is_online: int,
    changed_at: str,
    source: str | None,
    note: str | None,
) -> None:
    with connection() as conn:
        conn.execute(
            """
            INSERT INTO status_history (pc_id, status, is_online, changed_at, source, note)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (pc_id, status, is_online, changed_at, source, note),
        )
        conn.execute(
            """
            DELETE FROM status_history
            WHERE datetime(changed_at) < datetime('now', ?)
            """,
            (f"-{STATUS_HISTORY_RETENTION_DAYS} days",),
        )


def upsert_daily_summary(
    *,
    pc_id: str,
    date: str,
    tz: str,
    online_seconds: int,
    online_count: int,
    offline_count: int,
    first_online_at: str | None,
    last_online_at: str | None,
) -> None:
    with connection() as conn:
        conn.execute(
            """
            INSERT INTO uptime_daily_summary (
                pc_id,
                date,
                tz,
                online_seconds,
                online_count,
                offline_count,
                first_online_at,
                last_online_at,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(pc_id, date, tz) DO UPDATE SET
                online_seconds = excluded.online_seconds,
                online_count = excluded.online_count,
                offline_count = excluded.offline_count,
                first_online_at = excluded.first_online_at,
                last_online_at = excluded.last_online_at,
                updated_at = CURRENT_TIMESTAMP
            """,
            (
                pc_id,
                date,
                tz,
                online_seconds,
                online_count,
                offline_count,
                first_online_at,
                last_online_at,
            ),
        )


def list_daily_summary(
    *,
    pc_id: str,
    date_from: str,
    date_to: str,
    tz: str,
) -> list[PcUptimeDailySummaryRow]:
    with connection() as conn:
        rows = conn.execute(
            """
            SELECT
                pc_id,
                date,
                tz,
                online_seconds,
                online_count,
                offline_count,
                first_online_at,
                last_online_at,
                created_at,
                updated_at
            FROM uptime_daily_summary
            WHERE pc_id = ?
              AND date >= ?
              AND date <= ?
              AND tz = ?
            ORDER BY date ASC
            """,
            (pc_id, date_from, date_to, tz),
        ).fetchall()
    return [cast(PcUptimeDailySummaryRow, dict(row)) for row in rows]
