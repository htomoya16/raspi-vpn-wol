from __future__ import annotations

from pydantic import BaseModel


class LogItem(BaseModel):
    id: int
    action: str
    target: str
    status: str
    message: str | None = None
    created_at: str


class LogsResponse(BaseModel):
    limit: int
    items: list[LogItem]
