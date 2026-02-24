from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator


DB_PATH = Path(__file__).resolve().parent / "app.db"


def _normalize_mac_for_migration(mac_address: str) -> str:
    normalized = mac_address.strip().replace("-", ":").replace(".", "")
    compact = normalized.replace(":", "").lower()
    if len(compact) != 12:
        raise ValueError("invalid mac address length")
    try:
        int(compact, 16)
    except ValueError as exc:
        raise ValueError("invalid mac address format") from exc
    pairs = [compact[i : i + 2].upper() for i in range(0, 12, 2)]
    return ":".join(pairs)


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

        pc_rows = conn.execute(
            """
            SELECT id, mac_address
            FROM pcs
            """
        ).fetchall()
        for row in pc_rows:
            pc_id = str(row["id"])
            raw_mac = str(row["mac_address"])
            try:
                normalized_mac = _normalize_mac_for_migration(raw_mac)
            except ValueError as exc:
                raise RuntimeError(
                    "pcs.mac_address の一意制約マイグレーションに失敗: "
                    f"不正なMAC形式のレコードがあります。id={pc_id}, mac={raw_mac}"
                ) from exc
            if normalized_mac != raw_mac:
                conn.execute(
                    """
                    UPDATE pcs
                    SET mac_address = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    """,
                    (normalized_mac, pc_id),
                )

        duplicates = conn.execute(
            """
            SELECT
                mac_address,
                COUNT(*) AS cnt,
                GROUP_CONCAT(id, ', ') AS ids
            FROM pcs
            WHERE mac_address IS NOT NULL
              AND TRIM(mac_address) != ''
            GROUP BY mac_address
            HAVING COUNT(*) > 1
            ORDER BY cnt DESC, mac_address ASC
            """
        ).fetchall()
        if duplicates:
            duplicate_lines = [
                f"{row['mac_address']} ({row['cnt']}件): {row['ids']}"
                for row in duplicates
            ]
            joined = "; ".join(duplicate_lines)
            raise RuntimeError(
                "pcs.mac_address の一意制約マイグレーションに失敗: "
                f"重複MACが存在します。重複を解消してから再起動してください。{joined}"
            )
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_pcs_mac_address ON pcs(mac_address)"
        )
