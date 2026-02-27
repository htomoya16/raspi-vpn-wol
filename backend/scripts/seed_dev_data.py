from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.db.database import connection, init_db  # noqa: E402
from app.services import uptime_service  # noqa: E402


@dataclass(frozen=True)
class SeedPc:
    id: str
    name: str
    mac: str
    ip: str
    tags: list[str]
    note: str
    broadcast_ip: str
    send_interface: str = "eth0"
    wol_port: int = 9
    status_method: str = "tcp"
    status_port: int = 445


@dataclass(frozen=True)
class StatusEvent:
    pc_id: str
    at_utc: datetime
    status: str
    note: str


SEED_PCS: tuple[SeedPc, ...] = (
    SeedPc(
        id="seed-pc-main",
        name="Seed Main PC",
        mac="AA:BB:CC:00:10:01",
        ip="192.168.10.20",
        tags=["desk", "main"],
        note="dev seed main workstation",
        broadcast_ip="192.168.10.255",
    ),
    SeedPc(
        id="seed-pc-sub",
        name="Seed Sub PC",
        mac="AA:BB:CC:00:10:02",
        ip="192.168.10.21",
        tags=["desk", "sub"],
        note="dev seed short-session machine",
        broadcast_ip="192.168.10.255",
    ),
    SeedPc(
        id="seed-pc-lab",
        name="Seed Lab PC",
        mac="AA:BB:CC:00:10:03",
        ip="192.168.10.22",
        tags=["lab"],
        note="dev seed overnight machine",
        broadcast_ip="192.168.10.255",
    ),
)


def _parse_hm(value: str) -> tuple[int, int]:
    hour_text, minute_text = value.split(":")
    hour = int(hour_text)
    minute = int(minute_text)
    if hour < 0 or hour > 23 or minute < 0 or minute > 59:
        raise ValueError(f"invalid time: {value}")
    return hour, minute


def _at_local(day: date, hm: str, tz: ZoneInfo) -> datetime:
    hour, minute = _parse_hm(hm)
    return datetime.combine(day, time(hour, minute), tzinfo=tz)


def _add_interval(
    store: dict[str, list[tuple[datetime, datetime]]],
    *,
    pc_id: str,
    start_day: date,
    start_hm: str,
    end_day: date,
    end_hm: str,
    tz: ZoneInfo,
) -> None:
    start_local = _at_local(start_day, start_hm, tz)
    end_local = _at_local(end_day, end_hm, tz)
    if end_local <= start_local:
        raise ValueError(f"interval must end after start: {pc_id} {start_local.isoformat()} -> {end_local.isoformat()}")
    store[pc_id].append((start_local, end_local))


def _build_intervals(start_day: date, days: int, tz: ZoneInfo) -> dict[str, list[tuple[datetime, datetime]]]:
    intervals: dict[str, list[tuple[datetime, datetime]]] = {pc.id: [] for pc in SEED_PCS}
    for offset in range(days):
        day = start_day + timedelta(days=offset)
        next_day = day + timedelta(days=1)
        weekday = day.weekday()

        # Main PC: long daytime sessions + occasional cross-midnight session.
        if weekday <= 4:
            _add_interval(intervals, pc_id="seed-pc-main", start_day=day, start_hm="08:45", end_day=day, end_hm="12:15", tz=tz)
            _add_interval(intervals, pc_id="seed-pc-main", start_day=day, start_hm="13:10", end_day=day, end_hm="19:00", tz=tz)
        else:
            _add_interval(intervals, pc_id="seed-pc-main", start_day=day, start_hm="10:00", end_day=day, end_hm="11:30", tz=tz)
        if weekday == 2:
            _add_interval(intervals, pc_id="seed-pc-main", start_day=day, start_hm="23:20", end_day=next_day, end_hm="01:40", tz=tz)

        # Sub PC: short sessions to validate compact labels.
        if weekday in (1, 3, 5):
            _add_interval(intervals, pc_id="seed-pc-sub", start_day=day, start_hm="20:10", end_day=day, end_hm="20:32", tz=tz)
        if weekday == 6:
            _add_interval(intervals, pc_id="seed-pc-sub", start_day=day, start_hm="23:50", end_day=next_day, end_hm="00:25", tz=tz)

        # Lab PC: overnight heavy runtime + weekly afternoon block.
        if weekday != 5:
            _add_interval(intervals, pc_id="seed-pc-lab", start_day=day, start_hm="21:40", end_day=next_day, end_hm="02:30", tz=tz)
        if weekday == 0:
            _add_interval(intervals, pc_id="seed-pc-lab", start_day=day, start_hm="14:30", end_day=day, end_hm="15:20", tz=tz)

    for pc_intervals in intervals.values():
        pc_intervals.sort(key=lambda item: item[0])
    return intervals


def _build_events(
    intervals: dict[str, list[tuple[datetime, datetime]]],
    *,
    baseline_day: date,
    tz: ZoneInfo,
) -> list[StatusEvent]:
    events: list[StatusEvent] = []
    baseline_local = datetime.combine(baseline_day, time.min, tzinfo=tz) - timedelta(minutes=1)
    baseline_utc = baseline_local.astimezone(timezone.utc)

    for pc_id, pc_intervals in intervals.items():
        events.append(StatusEvent(pc_id=pc_id, at_utc=baseline_utc, status="offline", note="seed baseline"))
        for start_local, end_local in pc_intervals:
            events.append(
                StatusEvent(
                    pc_id=pc_id,
                    at_utc=start_local.astimezone(timezone.utc),
                    status="online",
                    note="seed interval start",
                )
            )
            events.append(
                StatusEvent(
                    pc_id=pc_id,
                    at_utc=end_local.astimezone(timezone.utc),
                    status="offline",
                    note="seed interval end",
                )
            )

    events.sort(key=lambda item: (item.pc_id, item.at_utc))
    compacted: list[StatusEvent] = []
    for event in events:
        if compacted and compacted[-1].pc_id == event.pc_id and compacted[-1].status == event.status:
            continue
        compacted.append(event)
    return compacted


def _placeholders(values: Iterable[object]) -> str:
    return ",".join("?" for _ in values)


def _upsert_seed_pcs(conn: sqlite3.Connection) -> None:
    for pc in SEED_PCS:
        conn.execute(
            """
            INSERT INTO pcs (
                id,
                name,
                mac_address,
                ip_address,
                tags_json,
                note,
                status,
                last_seen_at,
                broadcast_ip,
                send_interface,
                wol_port,
                status_method,
                status_port
            )
            VALUES (?, ?, ?, ?, ?, ?, 'unknown', NULL, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                mac_address = excluded.mac_address,
                ip_address = excluded.ip_address,
                tags_json = excluded.tags_json,
                note = excluded.note,
                broadcast_ip = excluded.broadcast_ip,
                send_interface = excluded.send_interface,
                wol_port = excluded.wol_port,
                status_method = excluded.status_method,
                status_port = excluded.status_port,
                updated_at = CURRENT_TIMESTAMP
            """,
            (
                pc.id,
                pc.name,
                pc.mac,
                pc.ip,
                json.dumps(pc.tags),
                pc.note,
                pc.broadcast_ip,
                pc.send_interface,
                pc.wol_port,
                pc.status_method,
                pc.status_port,
            ),
        )


def _clear_seed_data(conn: sqlite3.Connection) -> None:
    pc_ids = [pc.id for pc in SEED_PCS]
    placeholders = _placeholders(pc_ids)
    conn.execute(f"DELETE FROM status_history WHERE pc_id IN ({placeholders})", pc_ids)
    conn.execute(f"DELETE FROM uptime_daily_summary WHERE pc_id IN ({placeholders})", pc_ids)
    conn.execute(f"DELETE FROM logs WHERE pc_id IN ({placeholders}) AND action LIKE 'seed_%'", pc_ids)


def _insert_events(conn: sqlite3.Connection, events: list[StatusEvent]) -> None:
    for event in events:
        conn.execute(
            """
            INSERT INTO status_history (pc_id, status, is_online, changed_at, source, note)
            VALUES (?, ?, ?, ?, 'seed', ?)
            """,
            (
                event.pc_id,
                event.status,
                1 if event.status == "online" else 0,
                event.at_utc.isoformat(timespec="seconds"),
                event.note,
            ),
        )


def _update_current_pc_state(
    conn: sqlite3.Connection,
    *,
    events: list[StatusEvent],
    intervals: dict[str, list[tuple[datetime, datetime]]],
) -> None:
    now_utc = datetime.now(timezone.utc)
    for pc in SEED_PCS:
        pc_events = [event for event in events if event.pc_id == pc.id and event.at_utc <= now_utc]
        status = pc_events[-1].status if pc_events else "unknown"

        last_seen_utc: datetime | None = None
        for _, end_local in intervals[pc.id]:
            end_utc = end_local.astimezone(timezone.utc)
            if end_utc <= now_utc and (last_seen_utc is None or end_utc > last_seen_utc):
                last_seen_utc = end_utc

        conn.execute(
            """
            UPDATE pcs
            SET
                status = ?,
                last_seen_at = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (
                status,
                last_seen_utc.isoformat(timespec="seconds") if last_seen_utc is not None else None,
                pc.id,
            ),
        )


def _insert_seed_logs(conn: sqlite3.Connection, *, start_day: date, tz: ZoneInfo) -> None:
    for index, pc in enumerate(SEED_PCS):
        local_time = datetime.combine(start_day + timedelta(days=14 + index), time(8 + index, 30), tzinfo=tz)
        conn.execute(
            """
            INSERT INTO logs (pc_id, action, ok, status, message, details_json, created_at)
            VALUES (?, 'seed_wol', 1, 'ok', 'seed wol dispatch', ?, ?)
            """,
            (
                pc.id,
                json.dumps({"source": "seed", "repeat": 1, "port": pc.wol_port}),
                local_time.astimezone(timezone.utc).isoformat(timespec="seconds"),
            ),
        )

        local_status_time = local_time + timedelta(minutes=45)
        conn.execute(
            """
            INSERT INTO logs (pc_id, action, ok, status, message, details_json, created_at)
            VALUES (?, 'seed_status', 1, 'online', 'seed status refresh', ?, ?)
            """,
            (
                pc.id,
                json.dumps({"source": "seed", "method": "tcp"}),
                local_status_time.astimezone(timezone.utc).isoformat(timespec="seconds"),
            ),
        )


def _precompute_daily_summary(*, start_day: date, end_day: date, tz_name: str) -> None:
    for pc in SEED_PCS:
        uptime_service.get_pc_uptime_summary(
            pc_id=pc.id,
            from_date=start_day.isoformat(),
            to_date=end_day.isoformat(),
            bucket="day",
            tz_name=tz_name,
        )


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed development data for uptime UI and API checks.")
    parser.add_argument("--days", type=int, default=180, help="Number of historical days to seed (default: 180).")
    parser.add_argument("--tz", default="Asia/Tokyo", help="Timezone used for local schedule generation.")
    parser.add_argument(
        "--without-logs",
        action="store_true",
        help="Skip inserting seed logs (status_history and uptime summaries are still seeded).",
    )
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    if args.days < 7:
        raise ValueError("--days must be >= 7")

    try:
        tz = ZoneInfo(args.tz)
    except ZoneInfoNotFoundError as exc:
        raise ValueError(f"invalid timezone: {args.tz}") from exc

    init_db()

    today_local = datetime.now(timezone.utc).astimezone(tz).date()
    end_day = today_local - timedelta(days=1)
    start_day = end_day - timedelta(days=args.days - 1)

    intervals = _build_intervals(start_day, args.days, tz)
    events = _build_events(intervals, baseline_day=start_day, tz=tz)

    with connection() as conn:
        conn.execute("PRAGMA foreign_keys = ON")
        _upsert_seed_pcs(conn)
        _clear_seed_data(conn)
        _insert_events(conn, events)
        _update_current_pc_state(conn, events=events, intervals=intervals)
        if not args.without_logs:
            _insert_seed_logs(conn, start_day=start_day, tz=tz)

    _precompute_daily_summary(start_day=start_day, end_day=end_day, tz_name=args.tz)

    print(
        "seed completed:"
        f" pcs={len(SEED_PCS)}"
        f" status_history={len(events)}"
        f" range={start_day.isoformat()}..{end_day.isoformat()}"
        f" tz={args.tz}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
