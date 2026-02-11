from __future__ import annotations

import sqlite3
from typing import cast

from app.db.database import connection
from app.types import LogRow

LOG_RETENTION_DAYS = 30
LOG_MAX_ROWS = 7000


def insert_log_row(action: str, target: str, status: str, message: str | None = None) -> None:
    with connection() as conn:
        conn.execute(
            """
            INSERT INTO logs (action, target, status, message)
            VALUES (?, ?, ?, ?)
            """,
            (action, target, status, message),
        )
        _prune_old_logs(conn)
        _prune_excess_logs(conn)


def get_recent_logs(limit: int) -> list[LogRow]:
    with connection() as conn:
        rows = conn.execute(
            """
            SELECT id, action, target, status, message, created_at
            FROM logs
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return [cast(LogRow, dict(row)) for row in rows]


def _prune_old_logs(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        DELETE FROM logs
        WHERE created_at < datetime('now', ?)
        """,
        (f"-{LOG_RETENTION_DAYS} days",),
    )


def _prune_excess_logs(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        DELETE FROM logs
        WHERE id NOT IN (
            SELECT id
            FROM logs
            ORDER BY id DESC
            LIMIT ?
        )
        """,
        (LOG_MAX_ROWS,),
    )
