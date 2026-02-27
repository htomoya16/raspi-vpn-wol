from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

UptimeBucket = Literal["day", "week", "month", "year"]


class UptimeSummaryItem(BaseModel):
    label: str = Field(..., description="表示ラベル。")
    period_start: str = Field(..., description="集計開始日。")
    period_end: str = Field(..., description="集計終了日。")
    online_seconds: int = Field(..., ge=0, description="オンライン秒数。")
    online_ratio: float = Field(..., ge=0, le=1, description="オンライン比率。")


class PcUptimeSummaryResponse(BaseModel):
    pc_id: str = Field(..., description="対象PC ID。")
    from_date: str = Field(..., alias="from", description="集計開始日。")
    to_date: str = Field(..., alias="to", description="集計終了日。")
    bucket: UptimeBucket = Field(..., description="集計粒度。")
    tz: str = Field(..., description="タイムゾーン。")
    items: list[UptimeSummaryItem] = Field(..., description="集計結果。")

    model_config = {
        "populate_by_name": True,
    }


class UptimeWeeklyInterval(BaseModel):
    start: str = Field(..., description="区間開始時刻（HH:MM）。")
    end: str = Field(..., description="区間終了時刻（HH:MM）。")
    duration_seconds: int = Field(..., ge=0, description="区間秒数。")


class UptimeWeeklyDay(BaseModel):
    date: str = Field(..., description="日付（YYYY-MM-DD）。")
    online_seconds: int = Field(..., ge=0, description="当日のオンライン秒数。")
    intervals: list[UptimeWeeklyInterval] = Field(..., description="当日のオンライン区間。")


class PcWeeklyTimelineResponse(BaseModel):
    pc_id: str = Field(..., description="対象PC ID。")
    week_start: str = Field(..., description="週開始日。")
    week_end: str = Field(..., description="週終了日。")
    tz: str = Field(..., description="タイムゾーン。")
    days: list[UptimeWeeklyDay] = Field(..., description="週の1日ごとの区間情報。")
