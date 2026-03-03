from __future__ import annotations

import sqlite3
from typing import cast

from app.db.database import connection
from app.types import LogRow

LOG_RETENTION_DAYS = 30
LOG_MAX_ROWS = 7000
SUCCESS_STATUSES = {"ok", "online", "sent", "succeeded"}


def insert_log_row(
    action: str,
    pc_id: str,
    status: str,
    event_kind: str = "normal",
    job_id: str | None = None,
    api_token_id: str | None = None,
    actor_label: str | None = None,
    message: str | None = None,
    details_json: str | None = None,
) -> None:
    ok = 1 if status in SUCCESS_STATUSES else 0
    with connection() as conn:
        conn.execute(
            """
            INSERT INTO logs (
                pc_id,
                job_id,
                api_token_id,
                actor_label,
                action,
                event_kind,
                ok,
                status,
                message,
                details_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                pc_id or None,
                job_id or None,
                api_token_id or None,
                actor_label or None,
                action,
                event_kind,
                ok,
                status,
                message,
                details_json,
            ),
        )
        _prune_old_logs(conn)
        _prune_excess_logs(conn)


def list_logs(
    pc_id: str | None,
    action: str | None,
    ok: int | None,
    since: str | None,
    until: str | None,
    limit: int,
    cursor: int | None,
) -> list[LogRow]:
    clauses: list[str] = []
    params: list[object] = []

    if pc_id:
        clauses.append("pc_id = ?")
        params.append(pc_id)
    if action:
        clauses.append("action = ?")
        params.append(action)
    if ok is not None:
        clauses.append("ok = ?")
        params.append(ok)
    if since:
        clauses.append("created_at >= ?")
        params.append(since)
    if until:
        clauses.append("created_at <= ?")
        params.append(until)
    if cursor is not None:
        clauses.append("id < ?")
        params.append(cursor)

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    sql = (
        "SELECT id, pc_id, job_id, api_token_id, actor_label, action, event_kind, ok, message, details_json, created_at "
        f"FROM logs {where_sql} ORDER BY id DESC LIMIT ?"
    )
    params.append(limit)

    with connection() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [cast(LogRow, dict(row)) for row in rows]


def get_recent_logs(limit: int) -> list[LogRow]:
    return list_logs(
        pc_id=None,
        action=None,
        ok=None,
        since=None,
        until=None,
        limit=limit,
        cursor=None,
    )


def clear_logs() -> int:
    with connection() as conn:
        result = conn.execute("DELETE FROM logs")
    return int(result.rowcount or 0)


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
