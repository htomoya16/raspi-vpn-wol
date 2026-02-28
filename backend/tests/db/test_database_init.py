from __future__ import annotations

from pathlib import Path

import pytest

from app.db import database as db_module


def test_init_db_runs_alembic_upgrade_when_revisions_exist(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    test_db_path = tmp_path / "app-test.db"
    monkeypatch.setattr(db_module, "DB_PATH", test_db_path)
    monkeypatch.setattr(db_module, "_has_revision_files", lambda: True)

    config_obj = object()
    monkeypatch.setattr(db_module, "_build_alembic_config", lambda: config_obj)

    called: list[tuple[object, str]] = []
    monkeypatch.setattr(
        db_module.command,
        "upgrade",
        lambda config, revision: called.append((config, revision)),
    )

    db_module.init_db()

    assert called == [(config_obj, "head")]


def test_run_migrations_skips_upgrade_when_no_revisions(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    test_db_path = tmp_path / "app-test.db"
    monkeypatch.setattr(db_module, "DB_PATH", test_db_path)
    monkeypatch.setattr(db_module, "_has_revision_files", lambda: False)
    monkeypatch.setattr(
        db_module.command,
        "upgrade",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("must not be called")),
    )

    db_module.run_migrations()

    assert test_db_path.parent.exists()


def test_connection_commits_changes(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    test_db_path = tmp_path / "app-test.db"
    monkeypatch.setattr(db_module, "DB_PATH", test_db_path)

    with db_module.connection() as conn:
        conn.execute("CREATE TABLE sample (id INTEGER PRIMARY KEY, name TEXT NOT NULL)")
        conn.execute("INSERT INTO sample (name) VALUES (?)", ("alice",))

    with db_module.connection() as conn:
        row = conn.execute("SELECT name FROM sample WHERE id = 1").fetchone()

    assert row is not None
    assert row["name"] == "alice"

