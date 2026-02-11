from fastapi import APIRouter, Query

from app.services import status_service

router = APIRouter()


@router.get("/status")
def get_status(target: str = Query(..., min_length=1)) -> dict[str, str]:
    return status_service.get_status(target)
