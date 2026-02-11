from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services import wol_service

router = APIRouter()


class WolRequest(BaseModel):
    target: str


@router.post("/wol")
def send_wol(payload: WolRequest) -> dict[str, str]:
    try:
        return wol_service.send_wol(payload.target)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
