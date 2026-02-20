from __future__ import annotations

from pydantic import BaseModel, Field


class LogItem(BaseModel):
    id: int = Field(
        ...,
        ge=1,
        description="ログ ID（新しいほど大きい）。",
        json_schema_extra={"example": 101},
    )
    action: str = Field(
        ...,
        description="操作種別（例: wol, status, target_upsert, target_delete）。",
        json_schema_extra={"example": "wol"},
    )
    target: str = Field(
        ...,
        description="対象ターゲット ID。",
        json_schema_extra={"example": "main-pc"},
    )
    status: str = Field(
        ...,
        description="操作結果ステータス（例: sent, failed, online, offline）。",
        json_schema_extra={"example": "sent"},
    )
    message: str | None = Field(
        default=None,
        description="補足メッセージ。不要な場合は null。",
        json_schema_extra={"example": "wol packet sent: main-pc"},
    )
    created_at: str = Field(
        ...,
        description="記録時刻（ISO 8601 文字列）。",
        json_schema_extra={"example": "2026-02-20T12:34:56Z"},
    )


class LogsResponse(BaseModel):
    limit: int = Field(
        ...,
        ge=1,
        le=200,
        description="取得件数。",
        json_schema_extra={"example": 20},
    )
    items: list[LogItem] = Field(
        ...,
        description="ログ一覧（新しい順）。",
    )
