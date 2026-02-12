from __future__ import annotations

from app.repositories import log_repository
from app.types import LogRow


def insert_log(action: str, target: str, status: str, message: str | None = None) -> None:
    log_repository.insert_log_row(
        action=action,
        target=target,
        status=status,
        message=message,
    )


def fetch_logs(limit: int) -> list[LogRow]:
    return log_repository.get_recent_logs(limit)
