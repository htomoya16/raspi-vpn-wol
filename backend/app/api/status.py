from fastapi import APIRouter, HTTPException, Query

from app.models.status import StatusResponse
from app.services import status_service

router = APIRouter()


@router.get(
    "/status",
    response_model=StatusResponse,
    summary="ターゲットの起動状態を取得する",
    description="target の到達性を判定し、status は online/offline を返す。",
    responses={
        400: {"description": "業務エラー（対象未登録、IP未設定、判定方式不正など）"},
        422: {"description": "リクエスト形式エラー（target 未指定、型不正）"},
    },
)
def get_status(target: str = Query(..., min_length=1)) -> StatusResponse:
    try:
        return StatusResponse(**status_service.get_status(target))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
