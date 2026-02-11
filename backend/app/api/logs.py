from typing import Any

from fastapi import APIRouter, Query

from app.services import log_service

router = APIRouter()


@router.get("/logs")
def get_logs(limit: int = Query(20, ge=1, le=200)) -> dict[str, Any]:
    items = log_service.fetch_logs(limit)
    return {"limit": limit, "items": items}
