from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class StatusResponse(BaseModel):
    target: str = Field(
        ...,
        description="状態確認対象のターゲット ID。",
        json_schema_extra={"example": "main-pc"},
    )
    status: Literal["online", "offline"] = Field(
        ...,
        description="起動状態。online は到達成功、offline は到達失敗。",
        json_schema_extra={"example": "online"},
    )
