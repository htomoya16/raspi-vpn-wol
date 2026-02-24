from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

from app.db import database as db_module


def _create_pcs_table_without_unique_index(db_path: Path) -> None:
    conn = sqlite3.connect(db_path)
    try:
        conn.execute(
            """
            CREATE TABLE pcs (
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
        conn.commit()
    finally:
        conn.close()


def test_init_db_normalizes_existing_mac_addresses(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    test_db_path = tmp_path / "app-test.db"
    monkeypatch.setattr(db_module, "DB_PATH", test_db_path)

    db_module.init_db()
    with db_module.connection() as conn:
        conn.execute(
            """
            INSERT INTO pcs (id, name, mac_address)
            VALUES (?, ?, ?)
            """,
            ("pc-mac", "PC MAC", "aa-bb-cc-dd-ee-ff"),
        )

    db_module.init_db()

    with db_module.connection() as conn:
        row = conn.execute("SELECT mac_address FROM pcs WHERE id = ?", ("pc-mac",)).fetchone()

    assert row is not None
    assert row["mac_address"] == "AA:BB:CC:DD:EE:FF"


def test_init_db_raises_when_duplicate_mac_exists(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    test_db_path = tmp_path / "app-test.db"
    monkeypatch.setattr(db_module, "DB_PATH", test_db_path)

    _create_pcs_table_without_unique_index(test_db_path)

    conn = sqlite3.connect(test_db_path)
    try:
        conn.execute(
            "INSERT INTO pcs (id, name, mac_address) VALUES (?, ?, ?)",
            ("pc-1", "PC1", "aa-bb-cc-dd-ee-ff"),
        )
        conn.execute(
            "INSERT INTO pcs (id, name, mac_address) VALUES (?, ?, ?)",
            ("pc-2", "PC2", "AA:BB:CC:DD:EE:FF"),
        )
        conn.commit()
    finally:
        conn.close()

    with pytest.raises(RuntimeError, match="重複MAC"):
        db_module.init_db()
