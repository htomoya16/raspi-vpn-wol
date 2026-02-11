from fastapi import APIRouter, Query

from app.models.logs import LogItem, LogsResponse
from app.services import log_service

router = APIRouter()


@router.get("/logs", response_model=LogsResponse)
def get_logs(limit: int = Query(20, ge=1, le=200)) -> LogsResponse:
    items = [LogItem.model_validate(item) for item in log_service.fetch_logs(limit)]
    return LogsResponse(limit=limit, items=items)
