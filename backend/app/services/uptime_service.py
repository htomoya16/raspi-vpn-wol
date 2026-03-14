from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.repositories import pc_repository, uptime_repository

DEFAULT_UPTIME_TZ = "Asia/Tokyo"
DEFAULT_SUMMARY_DAYS = 30
STATUS_HISTORY_RETENTION_DAYS = 365 * 5


@dataclass
class _DailyAccumulator:
    online_seconds: int = 0
    online_count: int = 0
    first_online_at: datetime | None = None
    last_online_at: datetime | None = None


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _parse_utc_datetime(value: str) -> datetime:
    normalized = value.strip().replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _parse_timezone(tz_name: str | None) -> ZoneInfo:
    target = (tz_name or DEFAULT_UPTIME_TZ).strip() or DEFAULT_UPTIME_TZ
    try:
        return ZoneInfo(target)
    except ZoneInfoNotFoundError as exc:
        raise ValueError(f"invalid tz: {target}") from exc


def _parse_date(value: str, field_name: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ValueError(f"{field_name} must be YYYY-MM-DD") from exc


def _resolve_summary_range(
    from_date: str | None,
    to_date: str | None,
    tz: ZoneInfo,
) -> tuple[date, date]:
    if from_date is not None:
        start = _parse_date(from_date, "from")
    else:
        start = None

    if to_date is not None:
        end = _parse_date(to_date, "to")
    else:
        end = None

    if start is None and end is None:
        end = _utcnow().astimezone(tz).date()
        start = end - timedelta(days=DEFAULT_SUMMARY_DAYS - 1)
    elif start is None:
        assert end is not None
        start = end - timedelta(days=DEFAULT_SUMMARY_DAYS - 1)
    elif end is None:
        end = start + timedelta(days=DEFAULT_SUMMARY_DAYS - 1)

    if start > end:
        raise ValueError("from must be before or equal to to")
    return start, end


def _local_day_start_utc(target_date: date, tz: ZoneInfo) -> datetime:
    local_dt = datetime.combine(target_date, time.min, tzinfo=tz)
    return local_dt.astimezone(timezone.utc)


def _iter_dates(start_date: date, end_date: date) -> list[date]:
    current = start_date
    result: list[date] = []
    while current <= end_date:
        result.append(current)
        current += timedelta(days=1)
    return result


def _split_interval_by_local_day(
    start_utc: datetime,
    end_utc: datetime,
    tz: ZoneInfo,
) -> list[tuple[date, datetime, datetime]]:
    segments: list[tuple[date, datetime, datetime]] = []
    cursor = start_utc
    while cursor < end_utc:
        local_cursor = cursor.astimezone(tz)
        next_day_local = datetime.combine(local_cursor.date() + timedelta(days=1), time.min, tzinfo=tz)
        next_day_utc = next_day_local.astimezone(timezone.utc)
        segment_end = min(end_utc, next_day_utc)
        segments.append((local_cursor.date(), cursor, segment_end))
        cursor = segment_end
    return segments


def _ensure_pc_exists(pc_id: str) -> None:
    normalized_id = pc_id.strip()
    if not normalized_id:
        raise ValueError("pc_id is required")
    row = pc_repository.get_pc_by_id(normalized_id)
    if row is None:
        raise LookupError(f"pc not found: {normalized_id}")


def _collect_online_intervals(
    pc_id: str,
    start_utc: datetime,
    end_utc: datetime,
) -> list[tuple[datetime, datetime]]:
    if end_utc <= start_utc:
        return []

    start_iso = start_utc.isoformat()
    end_iso = end_utc.isoformat()

    previous = uptime_repository.get_latest_status_before(pc_id, start_iso)
    rows = uptime_repository.list_status_history_between(pc_id, start_iso, end_iso)

    events: list[tuple[datetime, str]] = []
    if previous is not None:
        events.append((start_utc, str(previous["status"])))

    for row in rows:
        changed_at = _parse_utc_datetime(str(row["changed_at"]))
        if changed_at < start_utc or changed_at >= end_utc:
            continue
        status = str(row["status"])
        if events and events[-1][0] == changed_at:
            events[-1] = (changed_at, status)
        else:
            events.append((changed_at, status))

    if not events:
        return []

    intervals: list[tuple[datetime, datetime]] = []
    for index, (event_time, status) in enumerate(events):
        next_time = events[index + 1][0] if index + 1 < len(events) else end_utc
        segment_start = max(start_utc, event_time)
        segment_end = min(end_utc, next_time)
        if status == "online" and segment_end > segment_start:
            intervals.append((segment_start, segment_end))

    return intervals


def _bucket_key(target_date: date, bucket: str) -> date:
    if bucket == "day":
        return target_date
    if bucket == "week":
        return target_date - timedelta(days=target_date.weekday())
    if bucket == "month":
        return target_date.replace(day=1)
    if bucket == "year":
        return target_date.replace(month=1, day=1)
    raise ValueError(f"unsupported bucket: {bucket}")


def _bucket_period_end(period_start: date, bucket: str) -> date:
    if bucket == "day":
        return period_start
    if bucket == "week":
        return period_start + timedelta(days=6)
    if bucket == "month":
        last_day = calendar.monthrange(period_start.year, period_start.month)[1]
        return period_start.replace(day=last_day)
    if bucket == "year":
        return period_start.replace(month=12, day=31)
    raise ValueError(f"unsupported bucket: {bucket}")


def _bucket_label(period_start: date, bucket: str) -> str:
    if bucket == "day":
        return period_start.isoformat()
    if bucket == "week":
        return period_start.isoformat()
    if bucket == "month":
        return period_start.strftime("%Y-%m")
    if bucket == "year":
        return str(period_start.year)
    raise ValueError(f"unsupported bucket: {bucket}")


def _bucket_denominator_seconds(period_start: date, bucket: str) -> int:
    if bucket == "day":
        return 24 * 60 * 60
    if bucket == "week":
        return 7 * 24 * 60 * 60
    if bucket == "month":
        return calendar.monthrange(period_start.year, period_start.month)[1] * 24 * 60 * 60
    if bucket == "year":
        days = 366 if calendar.isleap(period_start.year) else 365
        return days * 24 * 60 * 60
    raise ValueError(f"unsupported bucket: {bucket}")


def record_status_transition(
    *,
    pc_id: str,
    previous_status: str,
    next_status: str,
    changed_at: str | None = None,
    source: str | None = "runtime",
    note: str | None = None,
) -> bool:
    if previous_status == next_status:
        return False

    changed_at_text = changed_at or _utcnow().isoformat()
    uptime_repository.insert_status_history(
        pc_id=pc_id,
        status=next_status,
        is_online=1 if next_status == "online" else 0,
        changed_at=changed_at_text,
        source=source,
        note=note,
    )
    return True


def get_pc_uptime_summary(
    *,
    pc_id: str,
    from_date: str | None,
    to_date: str | None,
    bucket: str,
    tz_name: str | None,
) -> dict[str, object]:
    normalized_id = pc_id.strip()
    _ensure_pc_exists(normalized_id)
    tz = _parse_timezone(tz_name)

    start_date, end_date = _resolve_summary_range(from_date, to_date, tz)
    days = _iter_dates(start_date, end_date)

    today = _utcnow().astimezone(tz).date()
    retention_start = today - timedelta(days=STATUS_HISTORY_RETENTION_DAYS)
    recompute_start = max(start_date, retention_start)

    existing_rows = uptime_repository.list_daily_summary(
        pc_id=normalized_id,
        date_from=start_date.isoformat(),
        date_to=end_date.isoformat(),
        tz=str(tz.key),
    )
    existing_by_date = {
        date.fromisoformat(str(row["date"])): row
        for row in existing_rows
    }

    accumulators = {
        target_date: _DailyAccumulator()
        for target_date in days
        if target_date >= recompute_start
    }

    if recompute_start <= end_date:
        start_utc = _local_day_start_utc(recompute_start, tz)
        end_utc = _local_day_start_utc(end_date + timedelta(days=1), tz)
        effective_end_utc = min(end_utc, _utcnow())

        intervals: list[tuple[datetime, datetime]] = []
        if effective_end_utc > start_utc:
            intervals = _collect_online_intervals(normalized_id, start_utc, effective_end_utc)

        for interval_start, interval_end in intervals:
            for target_date, segment_start, segment_end in _split_interval_by_local_day(interval_start, interval_end, tz):
                if target_date not in accumulators:
                    continue
                duration_seconds = int((segment_end - segment_start).total_seconds())
                if duration_seconds <= 0:
                    continue
                bucket_item = accumulators[target_date]
                bucket_item.online_seconds += duration_seconds
                bucket_item.online_count += 1
                if bucket_item.first_online_at is None or segment_start < bucket_item.first_online_at:
                    bucket_item.first_online_at = segment_start
                if bucket_item.last_online_at is None or segment_end > bucket_item.last_online_at:
                    bucket_item.last_online_at = segment_end

    daily_items: list[dict[str, object]] = []
    for target_date in days:
        if target_date < recompute_start:
            existing = existing_by_date.get(target_date)
            online_seconds = int(existing["online_seconds"]) if existing is not None else 0
            daily_items.append(
                {
                    "date": target_date,
                    "online_seconds": online_seconds,
                    "online_ratio": round(online_seconds / 86400, 4),
                }
            )
            continue

        daily = accumulators[target_date]
        ratio = round(daily.online_seconds / 86400, 4)
        first_online_at = daily.first_online_at.isoformat() if daily.first_online_at is not None else None
        last_online_at = daily.last_online_at.isoformat() if daily.last_online_at is not None else None

        uptime_repository.upsert_daily_summary(
            pc_id=normalized_id,
            date=target_date.isoformat(),
            tz=str(tz.key),
            online_seconds=daily.online_seconds,
            online_count=daily.online_count,
            offline_count=0 if daily.online_seconds > 0 else 1,
            first_online_at=first_online_at,
            last_online_at=last_online_at,
        )

        daily_items.append(
            {
                "date": target_date,
                "online_seconds": daily.online_seconds,
                "online_ratio": ratio,
            }
        )

    grouped: dict[date, int] = {}
    for item in daily_items:
        key = _bucket_key(item["date"], bucket)
        grouped[key] = grouped.get(key, 0) + int(item["online_seconds"])

    items: list[dict[str, object]] = []
    for period_start in sorted(grouped.keys()):
        period_end = _bucket_period_end(period_start, bucket)
        denominator = _bucket_denominator_seconds(period_start, bucket)
        online_seconds = grouped[period_start]
        items.append(
            {
                "label": _bucket_label(period_start, bucket),
                "period_start": period_start.isoformat(),
                "period_end": period_end.isoformat(),
                "online_seconds": online_seconds,
                "online_ratio": round(online_seconds / denominator, 4) if denominator > 0 else 0,
            }
        )

    return {
        "pc_id": normalized_id,
        "from": start_date.isoformat(),
        "to": end_date.isoformat(),
        "bucket": bucket,
        "tz": str(tz.key),
        "items": items,
    }


def get_pc_weekly_timeline(
    *,
    pc_id: str,
    week_start: str | None,
    tz_name: str | None,
) -> dict[str, object]:
    normalized_id = pc_id.strip()
    _ensure_pc_exists(normalized_id)
    tz = _parse_timezone(tz_name)

    today = _utcnow().astimezone(tz).date()
    sunday_offset = (today.weekday() + 1) % 7
    default_week_start = today - timedelta(days=sunday_offset)
    target_week_start = _parse_date(week_start, "week_start") if week_start is not None else default_week_start
    if target_week_start.weekday() != 6:
        raise ValueError("week_start must be Sunday (YYYY-MM-DD)")

    retention_start = today - timedelta(days=STATUS_HISTORY_RETENTION_DAYS)
    if target_week_start < retention_start:
        raise ValueError("week_start is outside retention window")

    week_end = target_week_start + timedelta(days=6)

    start_utc = _local_day_start_utc(target_week_start, tz)
    end_utc = _local_day_start_utc(week_end + timedelta(days=1), tz)
    effective_end_utc = min(end_utc, _utcnow())

    day_data: dict[date, dict[str, object]] = {
        target_week_start + timedelta(days=offset): {"online_seconds": 0, "intervals": []}
        for offset in range(7)
    }

    intervals: list[tuple[datetime, datetime]] = []
    if effective_end_utc > start_utc:
        intervals = _collect_online_intervals(normalized_id, start_utc, effective_end_utc)

    for interval_start, interval_end in intervals:
        for target_date, segment_start, segment_end in _split_interval_by_local_day(interval_start, interval_end, tz):
            if target_date not in day_data:
                continue
            duration_seconds = int((segment_end - segment_start).total_seconds())
            if duration_seconds <= 0:
                continue

            start_local = segment_start.astimezone(tz)
            end_local = segment_end.astimezone(tz)

            day_entry = day_data[target_date]
            day_entry["online_seconds"] = int(day_entry["online_seconds"]) + duration_seconds
            day_entry["intervals"].append(
                {
                    "start": start_local.strftime("%H:%M"),
                    "end": end_local.strftime("%H:%M"),
                    "duration_seconds": duration_seconds,
                }
            )

    days: list[dict[str, object]] = []
    for offset in range(7):
        target_date = target_week_start + timedelta(days=offset)
        entry = day_data[target_date]
        days.append(
            {
                "date": target_date.isoformat(),
                "online_seconds": int(entry["online_seconds"]),
                "intervals": entry["intervals"],
            }
        )

    return {
        "pc_id": normalized_id,
        "week_start": target_week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "tz": str(tz.key),
        "days": days,
    }
