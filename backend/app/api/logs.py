from __future__ import annotations

from fastapi import APIRouter, Query

from app.models.logs import LogClearResponse, LogListResponse
from app.services import log_service

router = APIRouter()


@router.get(
    "/logs",
    response_model=LogListResponse,
    summary="操作ログ取得",
    responses={422: {"description": "リクエスト形式エラー"}},
)
def get_logs(
    pc_id: str | None = Query(default=None),
    action: str | None = Query(default=None),
    ok: bool | None = Query(default=None),
    since: str | None = Query(default=None),
    until: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    cursor: int | None = Query(default=None, ge=1),
) -> LogListResponse:
    items, next_cursor = log_service.fetch_logs(
        pc_id=pc_id,
        action=action,
        ok=ok,
        since=since,
        until=until,
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
