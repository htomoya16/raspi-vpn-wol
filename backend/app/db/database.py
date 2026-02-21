from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator


DB_PATH = Path(__file__).resolve().parent / "app.db"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def connection() -> Iterator[sqlite3.Connection]:
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    with connection() as conn:
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS pcs (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                mac_address TEXT NOT NULL,
                ip_address TEXT,
                tags_json TEXT NOT NULL DEFAULT '[]',
                note TEXT,
                status TEXT NOT NULL DEFAULT 'unknown',
                last_seen_at TEXT,
                broadcast_ip TEXT,
                send_interface TEXT NOT NULL DEFAULT 'eth0',
                wol_port INTEGER NOT NULL DEFAULT 9,
                status_method TEXT NOT NULL DEFAULT 'tcp',
                status_port INTEGER NOT NULL DEFAULT 445,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pc_id TEXT,
                action TEXT NOT NULL,
                ok INTEGER NOT NULL DEFAULT 1,
                status TEXT NOT NULL,
                message TEXT,
                error_code TEXT,
                details_json TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (pc_id) REFERENCES pcs(id) ON DELETE SET NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY,
                job_type TEXT NOT NULL,
                state TEXT NOT NULL,
                payload_json TEXT,
                result_json TEXT,
                error_message TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                started_at TEXT,
                finished_at TEXT,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_pcs_status ON pcs(status)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_pcs_name ON pcs(name)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_logs_pc_created_at ON logs(pc_id, created_at DESC)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_logs_action_created_at ON logs(action, created_at DESC)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_jobs_state_created_at ON jobs(state, created_at DESC)"
        )
