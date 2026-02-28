from __future__ import annotations

import json

from app.repositories import log_repository
from app.services import job_context
from app.types import LogRow


def insert_log(
    action: str,
    pc_id: str,
    status: str,
    message: str | None = None,
    details: dict[str, object] | None = None,
) -> None:
    normalized_details = dict(details) if details is not None else None
    current_job_id = job_context.get_current_job_id()

    details_json = json.dumps(normalized_details) if normalized_details is not None else None
    log_repository.insert_log_row(
        action=action,
        pc_id=pc_id,
        status=status,
        job_id=current_job_id,
        message=message,
        details_json=details_json,
    )


def fetch_logs(
    pc_id: str | None,
    action: str | None,
    ok: bool | None,
    since: str | None,
    until: str | None,
    limit: int,
    cursor: int | None,
) -> tuple[list[dict[str, object]], int | None]:
    rows = log_repository.list_logs(
        pc_id=pc_id,
        action=action,
        ok=(1 if ok else 0) if ok is not None else None,
        since=since,
        until=until,
        limit=limit + 1,
        cursor=cursor,
    )
    has_more = len(rows) > limit
    page = rows[:limit]
    items = [_row_to_log_entry(row) for row in page]
    next_cursor = page[-1]["id"] if has_more and page else None
    return items, next_cursor


def clear_logs() -> int:
    return log_repository.clear_logs()


def _row_to_log_entry(row: LogRow) -> dict[str, object]:
    details: dict[str, object] | None = None
    raw_details = row.get("details_json")
    if raw_details:
        try:
            decoded = json.loads(raw_details)
        except json.JSONDecodeError:
            decoded = {"raw": raw_details}
        if isinstance(decoded, dict):
            details = decoded
        else:
            details = {"value": decoded}

    return {
        "id": row["id"],
        "pc_id": row["pc_id"],
        "job_id": row.get("job_id"),
        "action": row["action"],
        "ok": bool(row["ok"]),
        "message": row["message"],
        "details": details,
        "created_at": row["created_at"],
    }
