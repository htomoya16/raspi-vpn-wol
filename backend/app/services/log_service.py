from __future__ import annotations

from typing import Any

from app.repositories import log_repository


def insert_log(action: str, target: str, status: str, message: str | None = None) -> None:
    log_repository.insert_log_row(
        action=action,
        target=target,
        status=status,
        message=message,
    )


def fetch_logs(limit: int) -> list[dict[str, Any]]:
    return log_repository.get_recent_logs(limit)
