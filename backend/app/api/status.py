from fastapi import APIRouter, HTTPException, Query

from app.models.status import StatusResponse
from app.services import status_service

router = APIRouter()


@router.get("/status", response_model=StatusResponse)
def get_status(target: str = Query(..., min_length=1)) -> StatusResponse:
    try:
        return StatusResponse.model_validate(status_service.get_status(target))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
