from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


JobState = Literal["queued", "running", "succeeded", "failed"]


class Job(BaseModel):
    id: str = Field(..., description="ジョブID。")
    type: str = Field(..., description="ジョブ種別。")
    state: JobState = Field(..., description="ジョブ状態。")
    payload: dict[str, object] | None = Field(default=None, description="投入時ペイロード。")
    result: dict[str, object] | None = Field(default=None, description="成功時結果。")
    error: str | None = Field(default=None, description="失敗時エラーメッセージ。")
    created_at: str = Field(..., description="作成時刻。")
    started_at: str | None = Field(default=None, description="開始時刻。")
    finished_at: str | None = Field(default=None, description="終了時刻。")
    updated_at: str = Field(..., description="更新時刻。")


class JobResponse(BaseModel):
    job: Job = Field(..., description="ジョブ情報。")


class JobAccepted(BaseModel):
    job_id: str = Field(..., description="受け付けたジョブID。")
    state: JobState = Field(..., description="受付直後の状態。", json_schema_extra={"example": "queued"})
