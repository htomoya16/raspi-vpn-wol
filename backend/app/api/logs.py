from fastapi import APIRouter, Query

from app.models.logs import LogsResponse
from app.services import log_service

router = APIRouter()


@router.get(
    "/logs",
    response_model=LogsResponse,
    summary="操作ログを取得する",
    description="最新ログを limit 件返す。並び順は新しい順。",
    responses={
        422: {"description": "リクエスト形式エラー（limit 範囲外、型不正）"},
    },
)
def get_logs(limit: int = Query(20, ge=1, le=200)) -> LogsResponse:
    return LogsResponse(limit=limit, items=log_service.fetch_logs(limit))
