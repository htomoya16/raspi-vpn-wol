from __future__ import annotations

from datetime import datetime
from pathlib import Path
import sqlite3

import pytest

from scripts import backup_db


def _create_source_db(path: Path) -> None:
    with sqlite3.connect(path) as conn:
        conn.execute("CREATE TABLE sample (id INTEGER PRIMARY KEY, name TEXT NOT NULL)")
        conn.execute("INSERT INTO sample (name) VALUES (?)", ("alice",))
        conn.commit()


def test_run_backup_dry_run_does_not_write_file(tmp_path: Path) -> None:
    source_db = tmp_path / "app.db"
    _create_source_db(source_db)
    output_dir = tmp_path / "backups"
    output_dir.mkdir(parents=True, exist_ok=True)

    (output_dir / "app-20260301-010101.db").write_bytes(b"old-1")
    (output_dir / "app-20260301-020202.db").write_bytes(b"old-2")
    (output_dir / "app-20260301-030303.db").write_bytes(b"old-3")

    result = backup_db.run_backup(
        source_db=source_db,
        output_dir=output_dir,
        keep=2,
        dry_run=True,
        now=datetime(2026, 3, 2, 3, 15, 0),
    )

    assert result.dry_run is True
    assert result.backup_path == output_dir / "app-20260302-031500.db"
    assert result.backup_path.exists() is False
    assert tuple(path.name for path in result.deleted_paths) == (
        "app-20260301-010101.db",
        "app-20260301-020202.db",
    )


def test_run_backup_creates_restorable_copy(tmp_path: Path) -> None:
    source_db = tmp_path / "app.db"
    _create_source_db(source_db)
    output_dir = tmp_path / "backups"

    result = backup_db.run_backup(
        source_db=source_db,
        output_dir=output_dir,
        keep=14,
        dry_run=False,
        now=datetime(2026, 3, 2, 4, 0, 0),
    )

    assert result.backup_path.exists()
    assert result.deleted_paths == ()
    with sqlite3.connect(result.backup_path) as conn:
        row = conn.execute("SELECT name FROM sample WHERE id = 1").fetchone()
    assert row is not None
    assert row[0] == "alice"


def test_run_backup_prunes_old_generations_after_create(tmp_path: Path) -> None:
    source_db = tmp_path / "app.db"
    _create_source_db(source_db)
    output_dir = tmp_path / "backups"
    output_dir.mkdir(parents=True, exist_ok=True)

    old_1 = output_dir / "app-20260301-010101.db"
    old_2 = output_dir / "app-20260301-020202.db"
    old_1.write_bytes(b"old-1")
    old_2.write_bytes(b"old-2")

    result = backup_db.run_backup(
        source_db=source_db,
        output_dir=output_dir,
        keep=2,
        dry_run=False,
        now=datetime(2026, 3, 2, 5, 0, 0),
    )

    assert result.backup_path.name == "app-20260302-050000.db"
    assert old_1.exists() is False
    assert old_2.exists() is True
    assert result.backup_path.exists() is True


def test_run_backup_raises_when_source_db_missing(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        backup_db.run_backup(
            source_db=tmp_path / "missing.db",
            output_dir=tmp_path / "backups",
            keep=14,
            dry_run=False,
        )
