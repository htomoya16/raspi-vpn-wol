from __future__ import annotations

from pydantic import BaseModel, Field


class WolRequest(BaseModel):
    target: str = Field(
        ...,
        min_length=1,
        description="WOL 送信対象のターゲット ID。",
        json_schema_extra={"example": "main-pc"},
    )


class WolResponse(BaseModel):
    message: str = Field(
        ...,
        description="WOL 送信結果メッセージ。",
        json_schema_extra={"example": "wol packet sent: main-pc"},
    )
