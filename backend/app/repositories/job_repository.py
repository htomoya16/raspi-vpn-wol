from __future__ import annotations

from datetime import datetime, timezone
from typing import cast
from uuid import uuid4

from app.db.database import connection
from app.types import JobRow


def create_job(job_type: str, payload_json: str | None) -> JobRow:
    job_id = uuid4().hex
    now_iso = datetime.now(timezone.utc).isoformat()
    with connection() as conn:
        conn.execute(
            """
            INSERT INTO jobs (
                id, job_type, state, payload_json, created_at, updated_at
            )
            VALUES (?, ?, 'queued', ?, ?, ?)
            """,
            (job_id, job_type, payload_json, now_iso, now_iso),
        )
    row = get_job(job_id)
    if row is None:
        raise ValueError(f"failed to create job: {job_id}")
    return row


def get_job(job_id: str) -> JobRow | None:
    with connection() as conn:
        row = conn.execute(
            """
            SELECT
                id,
                job_type,
                state,
                payload_json,
                result_json,
                error_message,
                created_at,
                started_at,
                finished_at,
                updated_at
            FROM jobs
            WHERE id = ?
            """,
            (job_id,),
        ).fetchone()
    if row is None:
        return None
    return cast(JobRow, dict(row))


def mark_running(job_id: str) -> None:
    now_iso = datetime.now(timezone.utc).isoformat()
    with connection() as conn:
        conn.execute(
            """
            UPDATE jobs
            SET state = 'running', started_at = ?, updated_at = ?
            WHERE id = ?
            """,
            (now_iso, now_iso, job_id),
        )


def mark_succeeded(job_id: str, result_json: str | None) -> None:
    now_iso = datetime.now(timezone.utc).isoformat()
    with connection() as conn:
        conn.execute(
            """
            UPDATE jobs
            SET
                state = 'succeeded',
                result_json = ?,
                finished_at = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (result_json, now_iso, now_iso, job_id),
        )


def mark_failed(job_id: str, error_message: str) -> None:
    now_iso = datetime.now(timezone.utc).isoformat()
    with connection() as conn:
        conn.execute(
            """
            UPDATE jobs
            SET
                state = 'failed',
                error_message = ?,
                finished_at = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (error_message, now_iso, now_iso, job_id),
        )
