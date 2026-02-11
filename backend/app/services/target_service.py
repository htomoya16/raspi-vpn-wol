from __future__ import annotations

import ipaddress
from typing import Any

from app.repositories import target_repository
from app.services.log_service import insert_log


def _normalize_mac_address(mac_address: str) -> str:
    normalized = mac_address.strip().replace("-", ":").replace(".", "")
    compact = normalized.replace(":", "").lower()
    if len(compact) != 12:
        raise ValueError("invalid mac address length")
    try:
        int(compact, 16)
    except ValueError as exc:
        raise ValueError("invalid mac address format") from exc

    pairs = [compact[i : i + 2].upper() for i in range(0, 12, 2)]
    return ":".join(pairs)


def list_targets() -> list[dict[str, Any]]:
    return target_repository.list_targets()


def _normalize_interface_name(send_interface: str | None) -> str:
    interface_name = (send_interface or "eth0").strip()
    if not interface_name:
        interface_name = "eth0"
    if len(interface_name) > 15:
        raise ValueError("send_interface must be 15 characters or less")
    if interface_name.lower().startswith("wg"):
        raise ValueError("wg interfaces are not allowed for WOL")
    return interface_name


def save_target(
    target_id: str,
    name: str,
    mac_address: str,
    ip_address: str | None = None,
    broadcast_ip: str | None = None,
    send_interface: str | None = None,
    wol_port: int = 9,
) -> dict[str, Any]:
    normalized_id = target_id.strip()
    normalized_name = name.strip()
    if not normalized_id:
        raise ValueError("id is required")
    if not normalized_name:
        raise ValueError("name is required")
    if wol_port < 1 or wol_port > 65535:
        raise ValueError("wol_port must be between 1 and 65535")
    if ip_address:
        ip_value = ipaddress.ip_address(ip_address.strip())
        if not isinstance(ip_value, ipaddress.IPv4Address):
            raise ValueError("ip_address must be an IPv4 address")
    if broadcast_ip:
        broadcast_value = ipaddress.ip_address(broadcast_ip.strip())
        if not isinstance(broadcast_value, ipaddress.IPv4Address):
            raise ValueError("broadcast_ip must be an IPv4 address")

    target_row = target_repository.upsert_target(
        target_id=normalized_id,
        name=normalized_name,
        mac_address=_normalize_mac_address(mac_address),
        ip_address=ip_address.strip() if ip_address else None,
        broadcast_ip=broadcast_ip.strip() if broadcast_ip else None,
        send_interface=_normalize_interface_name(send_interface),
        wol_port=wol_port,
    )

    insert_log(
        action="target_upsert",
        target=normalized_id,
        status="ok",
        message="target configuration saved",
    )

    return target_row
