from fastapi import APIRouter, HTTPException, Query

from app.services import status_service

router = APIRouter()


@router.get("/status")
def get_status(target: str = Query(..., min_length=1)) -> dict[str, str]:
    try:
        return status_service.get_status(target)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
