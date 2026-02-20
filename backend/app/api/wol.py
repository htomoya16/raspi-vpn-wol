from fastapi import APIRouter, HTTPException

from app.models.wol import WolRequest, WolResponse
from app.services import wol_service

router = APIRouter()


@router.post(
    "/wol",
    response_model=WolResponse,
    summary="指定ターゲットへ WOL を送信する",
    description="target で指定した端末へ Magic Packet を送信し、結果を返す。",
    responses={
        400: {"description": "業務エラー（対象未登録、送信設定不正など）"},
        422: {"description": "リクエスト形式エラー（必須項目不足、型不正）"},
    },
)
def send_wol(payload: WolRequest) -> WolResponse:
    try:
        return WolResponse(**wol_service.send_wol(payload.target))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
