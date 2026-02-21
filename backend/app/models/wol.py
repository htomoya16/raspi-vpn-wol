from __future__ import annotations

from pydantic import BaseModel, Field


class WolRequest(BaseModel):
    broadcast: str | None = Field(
        default=None,
        description="送信先ブロードキャストIP。未指定時はPC設定を使う。",
    )
    port: int | None = Field(
        default=None,
        ge=1,
        le=65535,
        description="WOL送信ポート。未指定時はPC設定を使う。",
    )
    repeat: int = Field(
        default=1,
        ge=1,
        le=5,
        description="送信回数。",
    )
