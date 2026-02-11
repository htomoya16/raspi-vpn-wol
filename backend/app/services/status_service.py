from __future__ import annotations

import ipaddress
import socket
import subprocess

from app.repositories import target_repository
from app.services.log_service import insert_log
from app.types import StatusResult

DEFAULT_STATUS_TIMEOUT_SECONDS = 1.0


def _status_offline(target_id: str, message: str) -> StatusResult:
    insert_log(action="status", target=target_id, status="offline", message=message)
    return {"target": target_id, "status": "offline"}


def _probe_ping(ip_value: ipaddress.IPv4Address, target_id: str) -> StatusResult:
    command = ["ping", "-c", "1", "-W", "1", str(ip_value)]
    try:
        result = subprocess.run(command, capture_output=True, text=True, check=False)
    except FileNotFoundError as exc:
        message = "ping command is not available"
        insert_log(action="status", target=target_id, status="failed", message=message)
        raise ValueError(message) from exc
    except OSError as exc:
        message = f"status probe failed to execute: {exc}"
        insert_log(action="status", target=target_id, status="failed", message=message)
        raise ValueError(message) from exc

    if result.returncode == 0:
        message = f"ping ok: {ip_value}"
        insert_log(action="status", target=target_id, status="online", message=message)
        return {"target": target_id, "status": "online"}

    return _status_offline(target_id, f"ping failed (code={result.returncode}): {ip_value}")


def _probe_tcp(ip_value: ipaddress.IPv4Address, status_port: int, target_id: str) -> StatusResult:
    try:
        with socket.create_connection((str(ip_value), status_port), timeout=DEFAULT_STATUS_TIMEOUT_SECONDS):
            pass
    except (socket.timeout, OSError) as exc:
        return _status_offline(target_id, f"tcp connect failed ({status_port}): {exc}")

    message = f"tcp connect ok: {ip_value}:{status_port}"
    insert_log(action="status", target=target_id, status="online", message=message)
    return {"target": target_id, "status": "online"}


def get_status(target: str) -> StatusResult:
    target_id = target.strip()
    if not target_id:
        raise ValueError("target is required")

    target_row = target_repository.get_target_by_id(target_id)
    if target_row is None:
        message = f"target not found: {target_id}"
        insert_log(action="status", target=target_id, status="failed", message=message)
        raise ValueError(message)

    target_ip = target_row.get("ip_address")
    if not target_ip:
        message = f"ip_address is not configured for target: {target_id}"
        insert_log(action="status", target=target_id, status="failed", message=message)
        raise ValueError(message)

    ip_text = str(target_ip).strip()
    try:
        ip_value = ipaddress.ip_address(ip_text)
    except ValueError as exc:
        message = f"invalid ip_address for target: {target_id}"
        insert_log(action="status", target=target_id, status="failed", message=message)
        raise ValueError(message) from exc
    if not isinstance(ip_value, ipaddress.IPv4Address):
        message = "status check supports IPv4 only"
        insert_log(action="status", target=target_id, status="failed", message=message)
        raise ValueError(message)

    status_method = str(target_row.get("status_method") or "tcp").strip().lower()
    if status_method == "ping":
        return _probe_ping(ip_value, target_id)
    if status_method == "tcp":
        status_port = int(target_row.get("status_port") or 445)
        if status_port < 1 or status_port > 65535:
            message = f"invalid status_port for target: {target_id}"
            insert_log(action="status", target=target_id, status="failed", message=message)
            raise ValueError(message)
        return _probe_tcp(ip_value, status_port, target_id)

    message = f"unsupported status_method for target: {target_id}"
    insert_log(action="status", target=target_id, status="failed", message=message)
    raise ValueError(message)
