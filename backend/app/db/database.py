from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from alembic import command
from alembic.config import Config


DB_PATH = Path(__file__).resolve().parent / "app.db"
BACKEND_ROOT = Path(__file__).resolve().parents[2]
ALEMBIC_INI_PATH = BACKEND_ROOT / "alembic.ini"
ALEMBIC_SCRIPT_LOCATION = BACKEND_ROOT / "alembic"


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


def _has_revision_files() -> bool:
    versions_dir = ALEMBIC_SCRIPT_LOCATION / "versions"
    if not versions_dir.exists():
        return False
    return any(path.suffix == ".py" and path.name != "__init__.py" for path in versions_dir.iterdir())


def _build_alembic_config() -> Config:
    config = Config(str(ALEMBIC_INI_PATH))
    config.set_main_option("script_location", str(ALEMBIC_SCRIPT_LOCATION))
    config.set_main_option("sqlalchemy.url", f"sqlite:///{DB_PATH}")
    # アプリ起動時の migration 実行では Uvicorn のロガー設定を上書きしない。
    config.attributes["configure_logger"] = False
    return config


def run_migrations(revision: str = "head") -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    # Alembic導入直後で revision がまだ無い場合に、開発サーバ起動をブロックしない。
    if not _has_revision_files():
        return

    alembic_config = _build_alembic_config()
    command.upgrade(alembic_config, revision)


def init_db() -> None:
    # 互換のため関数名は残し、中身はAlembic適用へ委譲する。
    run_migrations("head")
