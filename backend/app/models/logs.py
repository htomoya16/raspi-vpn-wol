from __future__ import annotations

from pydantic import BaseModel, Field


class LogEntry(BaseModel):
    id: int = Field(..., ge=1, description="ログID。")
    pc_id: str | None = Field(default=None, description="対象PCのID。")
    job_id: str | None = Field(default=None, description="関連ジョブID。ジョブ非関連ログは null。")
    action: str = Field(..., description="操作種別。")
    ok: bool = Field(..., description="成功時 true。")
    message: str | None = Field(default=None, description="補足メッセージ。")
    details: dict[str, object] | None = Field(default=None, description="任意詳細情報。")
    created_at: str = Field(..., description="記録時刻。")


class LogListResponse(BaseModel):
    items: list[LogEntry] = Field(..., description="ログ一覧（新しい順）。")
    next_cursor: int | None = Field(default=None, description="次ページ取得用カーソル。")


class LogClearResponse(BaseModel):
    deleted: int = Field(..., ge=0, description="削除したログ件数。")
