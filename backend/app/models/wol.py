from __future__ import annotations

from pydantic import BaseModel


class WolRequest(BaseModel):
    target: str


class WolResponse(BaseModel):
    message: str
