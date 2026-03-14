from __future__ import annotations

from urllib.parse import quote


PCS_LIST_PREFIX = "pcs:list:"
UPTIME_SUMMARY_PREFIX = "uptime:summary:"
UPTIME_WEEKLY_PREFIX = "uptime:weekly:"
STATUS_OFFLINE_STREAK_PREFIX = "status:offline_streak:"


def _part(value: str | None) -> str:
    return quote(value or "", safe="")


def pcs_list_key(
    *,
    q: str | None,
    status: str | None,
    tag: str | None,
    limit: int,
    cursor: str | None,
) -> str:
    return (
        f"{PCS_LIST_PREFIX}"
        f"q={_part(q)}:"
        f"status={_part(status)}:"
        f"tag={_part(tag)}:"
        f"limit={limit}:"
        f"cursor={_part(cursor)}"
    )


def uptime_summary_key(
    *,
    pc_id: str,
    from_date: str | None,
    to_date: str | None,
    bucket: str,
    tz: str | None,
) -> str:
    return (
        f"{UPTIME_SUMMARY_PREFIX}"
        f"pc={_part(pc_id)}:"
        f"bucket={_part(bucket)}:"
        f"from={_part(from_date)}:"
        f"to={_part(to_date)}:"
        f"tz={_part(tz)}"
    )


def uptime_weekly_key(
    *,
    pc_id: str,
    week_start: str | None,
    tz: str | None,
) -> str:
    return (
        f"{UPTIME_WEEKLY_PREFIX}"
        f"pc={_part(pc_id)}:"
        f"week_start={_part(week_start)}:"
        f"tz={_part(tz)}"
    )


def uptime_summary_pc_prefix(pc_id: str) -> str:
    return f"{UPTIME_SUMMARY_PREFIX}pc={_part(pc_id)}:"


def uptime_weekly_pc_prefix(pc_id: str) -> str:
    return f"{UPTIME_WEEKLY_PREFIX}pc={_part(pc_id)}:"


def status_offline_streak_key(pc_id: str) -> str:
    return f"{STATUS_OFFLINE_STREAK_PREFIX}pc={_part(pc_id)}"
