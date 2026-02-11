from __future__ import annotations

from typing import TypedDict


class TargetRow(TypedDict):
    id: str
    name: str
    mac_address: str
    ip_address: str | None
    broadcast_ip: str | None
    send_interface: str
    wol_port: int
    status_method: str
    status_port: int
    created_at: str
    updated_at: str


class LogRow(TypedDict):
    id: int
    action: str
    target: str
    status: str
    message: str | None
    created_at: str


class WolResult(TypedDict):
    message: str


class StatusResult(TypedDict):
    target: str
    status: str


class TargetDeletedResult(TypedDict):
    id: str
