from fastapi import APIRouter, HTTPException

from app.models.wol import WolRequest, WolResponse
from app.services import wol_service

router = APIRouter()


@router.post("/wol", response_model=WolResponse)
def send_wol(payload: WolRequest) -> WolResponse:
    try:
        return WolResponse.model_validate(wol_service.send_wol(payload.target))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
