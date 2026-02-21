from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.services import event_service

router = APIRouter()


@router.get(
    "/events",
    summary="SSEイベントストリーム",
    responses={200: {"description": "text/event-stream"}},
)
async def stream_events() -> StreamingResponse:
    return StreamingResponse(
        event_service.event_broker.stream(),
        media_type="text/event-stream",
    )
