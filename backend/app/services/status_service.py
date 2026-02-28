from __future__ import annotations

import ipaddress
import socket
import subprocess

from app.repositories import pc_repository
from app.services import job_context
from app.services.log_service import insert_log
from app.types import PcStatusProbeResult

DEFAULT_STATUS_TIMEOUT_SECONDS = 1.0


def _status_event_kind() -> str:
    if job_context.is_current_periodic_status_job():
        return "periodic_status"
    return "normal"


def _status_offline(pc_id: str, message: str) -> PcStatusProbeResult:
    insert_log(action="status", event_kind=_status_event_kind(), pc_id=pc_id, status="offline", message=message)
    return {"pc_id": pc_id, "status": "offline"}


def _probe_ping(ip_value: ipaddress.IPv4Address, pc_id: str) -> PcStatusProbeResult:
    command = ["ping", "-c", "1", "-W", "1", str(ip_value)]
    try:
        result = subprocess.run(command, capture_output=True, text=True, check=False)
    except FileNotFoundError as exc:
        message = "ping command is not available"
        insert_log(action="status", event_kind=_status_event_kind(), pc_id=pc_id, status="failed", message=message)
        raise ValueError(message) from exc
    except OSError as exc:
        message = f"status probe failed to execute: {exc}"
        insert_log(action="status", event_kind=_status_event_kind(), pc_id=pc_id, status="failed", message=message)
        raise ValueError(message) from exc

    if result.returncode == 0:
        message = f"ping ok: {ip_value}"
        insert_log(action="status", event_kind=_status_event_kind(), pc_id=pc_id, status="online", message=message)
        return {"pc_id": pc_id, "status": "online"}

    return _status_offline(pc_id, f"ping failed (code={result.returncode}): {ip_value}")


def _probe_tcp(ip_value: ipaddress.IPv4Address, status_port: int, pc_id: str) -> PcStatusProbeResult:
    try:
        with socket.create_connection((str(ip_value), status_port), timeout=DEFAULT_STATUS_TIMEOUT_SECONDS):
            pass
    except (socket.timeout, OSError) as exc:
        return _status_offline(pc_id, f"tcp connect failed ({status_port}): {exc}")

    message = f"tcp connect ok: {ip_value}:{status_port}"
    insert_log(action="status", event_kind=_status_event_kind(), pc_id=pc_id, status="online", message=message)
    return {"pc_id": pc_id, "status": "online"}


def get_pc_status(pc_id: str) -> PcStatusProbeResult:
    normalized_id = pc_id.strip()
    if not normalized_id:
        raise ValueError("pc_id is required")

    pc_row = pc_repository.get_pc_by_id(normalized_id)
    if pc_row is None:
        message = f"pc not found: {normalized_id}"
        insert_log(
            action="status",
            event_kind=_status_event_kind(),
            pc_id=normalized_id,
            status="failed",
            message=message,
        )
        raise ValueError(message)

    pc_ip = pc_row.get("ip_address")
    if not pc_ip:
        message = f"ip_address is required for pc: {normalized_id}"
        insert_log(
            action="status",
            event_kind=_status_event_kind(),
            pc_id=normalized_id,
            status="failed",
            message=message,
        )
        raise ValueError(message)

    ip_text = str(pc_ip).strip()
    try:
        ip_value = ipaddress.ip_address(ip_text)
    except ValueError as exc:
        message = f"invalid ip_address for pc: {normalized_id}"
        insert_log(
            action="status",
            event_kind=_status_event_kind(),
            pc_id=normalized_id,
            status="failed",
            message=message,
        )
        raise ValueError(message) from exc
    if not isinstance(ip_value, ipaddress.IPv4Address):
        message = "status check supports IPv4 only"
        insert_log(
            action="status",
            event_kind=_status_event_kind(),
            pc_id=normalized_id,
            status="failed",
            message=message,
        )
        raise ValueError(message)

    status_method = str(pc_row.get("status_method") or "tcp").strip().lower()
    if status_method == "ping":
        return _probe_ping(ip_value, normalized_id)
    if status_method == "tcp":
        status_port = int(pc_row.get("status_port") or 445)
        if status_port < 1 or status_port > 65535:
            message = f"invalid status_port for pc: {normalized_id}"
            insert_log(
                action="status",
                event_kind=_status_event_kind(),
                pc_id=normalized_id,
                status="failed",
                message=message,
            )
            raise ValueError(message)
        return _probe_tcp(ip_value, status_port, normalized_id)

    message = f"unsupported status_method for pc: {normalized_id}"
    insert_log(
        action="status",
        event_kind=_status_event_kind(),
        pc_id=normalized_id,
        status="failed",
        message=message,
    )
    raise ValueError(message)
