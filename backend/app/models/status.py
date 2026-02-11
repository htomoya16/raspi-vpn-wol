from __future__ import annotations

from pydantic import BaseModel


class StatusResponse(BaseModel):
    target: str
    status: str
