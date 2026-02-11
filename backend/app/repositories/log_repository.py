from __future__ import annotations

from typing import Any

from app.db.database import connection


def insert_log_row(action: str, target: str, status: str, message: str | None = None) -> None:
    with connection() as conn:
        conn.execute(
            """
            INSERT INTO logs (action, target, status, message)
            VALUES (?, ?, ?, ?)
            """,
            (action, target, status, message),
        )


def get_recent_logs(limit: int) -> list[dict[str, Any]]:
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

    return [dict(row) for row in rows]
