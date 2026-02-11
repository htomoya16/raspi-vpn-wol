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
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS targets (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                mac_address TEXT NOT NULL,
                ip_address TEXT,
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
                action TEXT NOT NULL,
                target TEXT NOT NULL,
                status TEXT NOT NULL,
                message TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        _migrate_targets_table(conn)


def _migrate_targets_table(conn: sqlite3.Connection) -> None:
    rows = conn.execute("PRAGMA table_info(targets)").fetchall()
    columns = {str(row["name"]) for row in rows}
    if "send_interface" not in columns:
        conn.execute(
            """
            ALTER TABLE targets
            ADD COLUMN send_interface TEXT NOT NULL DEFAULT 'eth0'
            """
        )
    if "status_method" not in columns:
        conn.execute(
            """
            ALTER TABLE targets
            ADD COLUMN status_method TEXT NOT NULL DEFAULT 'tcp'
            """
        )
    if "status_port" not in columns:
        conn.execute(
            """
            ALTER TABLE targets
            ADD COLUMN status_port INTEGER NOT NULL DEFAULT 445
            """
        )
