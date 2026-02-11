from __future__ import annotations

import ipaddress
import subprocess

from app.repositories import target_repository
from app.services.log_service import insert_log


def get_status(target: str) -> dict[str, str]:
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
        status = "online"
        message = f"ping ok: {ip_value}"
    else:
        status = "offline"
        message = f"ping failed (code={result.returncode}): {ip_value}"

    insert_log(
        action="status",
        target=target_id,
        status=status,
        message=message,
    )

    return {"target": target_id, "status": status}
