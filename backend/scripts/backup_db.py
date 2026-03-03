from __future__ import annotations

import argparse
import os
import sqlite3
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
import re

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.db.database import DB_PATH  # noqa: E402

DEFAULT_KEEP = 30
DEFAULT_OUTPUT_DIR = BACKEND_DIR / "backups"
BACKUP_FILENAME_RE = re.compile(r"^app-\d{8}-\d{6}\.db$")


@dataclass(frozen=True)
class BackupResult:
    backup_path: Path
    deleted_paths: tuple[Path, ...]
    dry_run: bool


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create a SQLite backup and prune old generations.")
    parser.add_argument("--dry-run", action="store_true", help="Show planned actions without writing files.")
    parser.add_argument(
        "--keep",
        type=int,
        default=DEFAULT_KEEP,
        help=f"Number of backup generations to keep (default: {DEFAULT_KEEP}).",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help=f"Backup destination directory (default: {DEFAULT_OUTPUT_DIR}).",
    )
    args = parser.parse_args()
    if args.keep < 1:
        parser.error("--keep must be 1 or greater")
    return args


def _resolve_output_dir(path: Path) -> Path:
    if path.is_absolute():
        return path
    return BACKEND_DIR / path


def _backup_filename(now: datetime) -> str:
    return f"app-{now.strftime('%Y%m%d-%H%M%S')}.db"


def _list_backups(output_dir: Path) -> list[Path]:
    if not output_dir.exists():
        return []
    backups = [path for path in output_dir.iterdir() if path.is_file() and BACKUP_FILENAME_RE.match(path.name)]
    backups.sort(key=lambda path: path.name)
    return backups


def _prune_targets(backups: list[Path], keep: int) -> list[Path]:
    if len(backups) <= keep:
        return []
    return backups[: len(backups) - keep]


def _copy_sqlite_db(source_db: Path, backup_path: Path) -> None:
    with sqlite3.connect(source_db) as source_conn:
        with sqlite3.connect(backup_path) as backup_conn:
            source_conn.backup(backup_conn)
    os.chmod(backup_path, 0o600)


def run_backup(
    *,
    source_db: Path,
    output_dir: Path,
    keep: int,
    dry_run: bool,
    now: datetime | None = None,
) -> BackupResult:
    if not source_db.exists():
        raise FileNotFoundError(f"source DB not found: {source_db}")
    if keep < 1:
        raise ValueError("keep must be 1 or greater")

    timestamp = now or datetime.now()
    backup_path = output_dir / _backup_filename(timestamp)

    current_backups = _list_backups(output_dir)
    planned_backups = sorted([*current_backups, backup_path], key=lambda path: path.name)
    to_delete = tuple(_prune_targets(planned_backups, keep))

    if dry_run:
        return BackupResult(backup_path=backup_path, deleted_paths=to_delete, dry_run=True)

    output_dir.mkdir(parents=True, exist_ok=True)
    if backup_path.exists():
        raise FileExistsError(f"backup already exists: {backup_path}")
    _copy_sqlite_db(source_db, backup_path)

    existing_after_create = _list_backups(output_dir)
    for old_path in _prune_targets(existing_after_create, keep):
        old_path.unlink(missing_ok=False)

    return BackupResult(backup_path=backup_path, deleted_paths=to_delete, dry_run=False)


def _format_paths(paths: tuple[Path, ...]) -> str:
    if not paths:
        return "none"
    return ", ".join(str(path) for path in paths)


def main() -> int:
    try:
        args = _parse_args()
        output_dir = _resolve_output_dir(args.output_dir)
        result = run_backup(
            source_db=DB_PATH,
            output_dir=output_dir,
            keep=args.keep,
            dry_run=args.dry_run,
        )
    except Exception as exc:  # pragma: no cover - CLI error path
        print(f"error: {exc}", file=sys.stderr)
        return 1

    print(f"source_db={DB_PATH}")
    print(f"backup_path={result.backup_path}")
    print(f"dry_run={result.dry_run}")
    print(f"prune_targets={_format_paths(result.deleted_paths)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
