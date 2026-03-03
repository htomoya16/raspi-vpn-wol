from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from app.db import database as db_module
from app.repositories import job_repository


def _insert_job(*, job_id: str, state: str, created_at: str) -> None:
    with db_module.connection() as conn:
        conn.execute(
            """
            INSERT INTO jobs (
                id,
                job_type,
                state,
                payload_json,
                created_at,
                updated_at
            )
            VALUES (?, 'status_refresh_all', ?, NULL, ?, ?)
            """,
            (job_id, state, created_at, created_at),
        )


def test_create_job_prunes_old_finished_jobs_but_keeps_active_jobs(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    test_db_path = tmp_path / "app-test.db"
    monkeypatch.setattr(db_module, "DB_PATH", test_db_path)
    db_module.run_migrations("head")

    monkeypatch.setattr(job_repository, "JOB_RETENTION_DAYS", 1)
    monkeypatch.setattr(job_repository, "JOB_MAX_ROWS", 1000)

    now = datetime.now(timezone.utc)
    old_iso = (now - timedelta(days=3)).isoformat()
    recent_iso = (now - timedelta(hours=1)).isoformat()

    _insert_job(job_id="job-old-succeeded", state="succeeded", created_at=old_iso)
    _insert_job(job_id="job-old-failed", state="failed", created_at=old_iso)
    _insert_job(job_id="job-old-queued", state="queued", created_at=old_iso)
    _insert_job(job_id="job-recent-succeeded", state="succeeded", created_at=recent_iso)

    created = job_repository.create_job("status_refresh_all", payload_json=None)

    with db_module.connection() as conn:
        rows = conn.execute("SELECT id FROM jobs").fetchall()
    job_ids = {str(row["id"]) for row in rows}

    assert "job-old-succeeded" not in job_ids
    assert "job-old-failed" not in job_ids
    assert "job-old-queued" in job_ids
    assert "job-recent-succeeded" in job_ids
    assert str(created["id"]) in job_ids


def test_create_job_prunes_excess_finished_jobs_and_keeps_active_jobs(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    test_db_path = tmp_path / "app-test.db"
    monkeypatch.setattr(db_module, "DB_PATH", test_db_path)
    db_module.run_migrations("head")

    monkeypatch.setattr(job_repository, "JOB_RETENTION_DAYS", 3650)
    monkeypatch.setattr(job_repository, "JOB_MAX_ROWS", 3)

    now = datetime.now(timezone.utc)
    _insert_job(
        job_id="job-running-old",
        state="running",
        created_at=(now - timedelta(days=5)).isoformat(),
    )
    for index in range(1, 6):
        _insert_job(
            job_id=f"job-succeeded-{index}",
            state="succeeded",
            created_at=(now - timedelta(minutes=6 - index)).isoformat(),
        )

    created = job_repository.create_job("status_refresh_all", payload_json=None)

    with db_module.connection() as conn:
        rows = conn.execute("SELECT id, state FROM jobs").fetchall()
    state_by_id = {str(row["id"]): str(row["state"]) for row in rows}

    assert "job-running-old" in state_by_id
    assert str(created["id"]) in state_by_id
    assert "job-succeeded-5" in state_by_id
    assert "job-succeeded-4" in state_by_id
    assert "job-succeeded-3" not in state_by_id
    assert "job-succeeded-2" not in state_by_id
    assert "job-succeeded-1" not in state_by_id
