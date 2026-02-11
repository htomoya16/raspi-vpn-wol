from fastapi import APIRouter, Query

from app.models.logs import LogsResponse
from app.services import log_service

router = APIRouter()


@router.get("/logs", response_model=LogsResponse)
def get_logs(limit: int = Query(20, ge=1, le=200)) -> LogsResponse:
    return LogsResponse(limit=limit, items=log_service.fetch_logs(limit))
