from __future__ import annotations

from typing import Literal, TypedDict


PcStatus = Literal["online", "offline", "unknown", "booting", "unreachable"]
JobState = Literal["queued", "running", "succeeded", "failed"]


class PcRow(TypedDict):
    id: str
    name: str
    mac_address: str
    ip_address: str
    tags_json: str
    note: str | None
    status: PcStatus
    last_seen_at: str | None
    broadcast_ip: str | None
    send_interface: str
    wol_port: int
    status_method: str
    status_port: int
    created_at: str
    updated_at: str


class LogRow(TypedDict):
    id: int
    pc_id: str | None
    job_id: str | None
    action: str
    ok: int
    message: str | None
    details_json: str | None
    created_at: str


class JobRow(TypedDict):
    id: str
    job_type: str
    state: JobState
    payload_json: str | None
    result_json: str | None
    error_message: str | None
    created_at: str
    started_at: str | None
    finished_at: str | None
    updated_at: str


class PcStatusHistoryRow(TypedDict):
    id: int
    pc_id: str
    status: PcStatus
    is_online: int
    changed_at: str
    source: str | None
    note: str | None
    created_at: str


class PcUptimeDailySummaryRow(TypedDict):
    pc_id: str
    date: str
    tz: str
    online_seconds: int
    online_count: int
    offline_count: int
    first_online_at: str | None
    last_online_at: str | None
    created_at: str
    updated_at: str


class WolResult(TypedDict):
    message: str


class PcStatusProbeResult(TypedDict):
    pc_id: str
    status: str


class PcDeletedResult(TypedDict):
    id: str
