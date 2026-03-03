from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Query, Response
from fastapi import HTTPException

from app.models.logs import LogClearResponse, LogListResponse
from app.services import log_service

router = APIRouter()


def _normalize_iso8601_datetime(value: str, field_name: str) -> str:
    text = value.strip()
    if not text:
        raise ValueError(f"{field_name} must be ISO-8601 datetime with timezone")

    normalized = text.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise ValueError(f"{field_name} must be ISO-8601 datetime with timezone") from exc

    if parsed.tzinfo is None:
        raise ValueError(f"{field_name} must include timezone offset")
    return parsed.astimezone(timezone.utc).isoformat()


@router.get(
    "/logs",
    response_model=LogListResponse,
    summary="操作ログ取得",
    responses={
        400: {"description": "入力値不正"},
        422: {"description": "リクエスト形式エラー"},
    },
)
def get_logs(
    response: Response,
    pc_id: str | None = Query(default=None),
    action: str | None = Query(default=None),
    ok: bool | None = Query(default=None),
    since: str | None = Query(default=None),
    until: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    cursor: int | None = Query(default=None, ge=1),
) -> LogListResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        normalized_since = _normalize_iso8601_datetime(since, "since") if since is not None else None
        normalized_until = _normalize_iso8601_datetime(until, "until") if until is not None else None
        if normalized_since is not None and normalized_until is not None and normalized_since > normalized_until:
            raise ValueError("since must be before or equal to until")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    items, next_cursor = log_service.fetch_logs(
        pc_id=pc_id,
        action=action,
        ok=ok,
        since=normalized_since,
        until=normalized_until,
        limit=limit,
        cursor=cursor,
    )
    return LogListResponse(items=items, next_cursor=next_cursor)


@router.delete(
    "/logs",
    response_model=LogClearResponse,
    summary="操作ログ全削除",
)
def clear_logs() -> LogClearResponse:
    deleted = log_service.clear_logs()
    return LogClearResponse(deleted=deleted)
