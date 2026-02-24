from __future__ import annotations

import ipaddress
import json
from datetime import datetime, timezone

from app.repositories import pc_repository
from app.services.log_service import insert_log
from app.types import PcDeletedResult, PcRow

STATUS_VALUES = {"online", "offline", "unknown", "booting", "unreachable"}


def normalize_mac_address(mac_address: str) -> str:
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


def list_pcs() -> list[PcRow]:
    return pc_repository.list_pcs()


def _normalize_interface_name(send_interface: str | None) -> str:
    interface_name = (send_interface or "eth0").strip()
    if not interface_name:
        interface_name = "eth0"
    if len(interface_name) > 15:
        raise ValueError("send_interface must be 15 characters or less")
    if interface_name.lower().startswith("wg"):
        raise ValueError("wg interfaces are not allowed for WOL")
    return interface_name


def _normalize_status_method(status_method: str | None) -> str:
    method = (status_method or "tcp").strip().lower()
    if method not in {"tcp", "ping"}:
        raise ValueError("status_method must be 'tcp' or 'ping'")
    return method


def upsert_pc(
    pc_id: str,
    name: str,
    mac_address: str,
    ip_address: str | None = None,
    tags: list[str] | None = None,
    note: str | None = None,
    status: str | None = None,
    last_seen_at: str | None = None,
    broadcast_ip: str | None = None,
    send_interface: str | None = None,
    wol_port: int = 9,
    status_method: str | None = None,
    status_port: int | None = None,
) -> PcRow:
    normalized_id = pc_id.strip()
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
    normalized_status_method = _normalize_status_method(status_method)
    normalized_status_port = status_port if status_port is not None else 445
    if normalized_status_port < 1 or normalized_status_port > 65535:
        raise ValueError("status_port must be between 1 and 65535")
    if status is not None and status not in STATUS_VALUES:
        raise ValueError(f"status must be one of: {', '.join(sorted(STATUS_VALUES))}")

    existing = pc_repository.get_pc_by_id(normalized_id)
    persisted_status = status or (existing["status"] if existing else "unknown")
    persisted_last_seen_at = last_seen_at
    if persisted_last_seen_at is None and existing:
        persisted_last_seen_at = existing.get("last_seen_at")
    persisted_note = note
    if persisted_note is None and existing:
        persisted_note = existing.get("note")
    persisted_tags = tags
    if persisted_tags is None:
        if existing:
            try:
                persisted_tags = json.loads(existing.get("tags_json", "[]"))
            except json.JSONDecodeError:
                persisted_tags = []
        else:
            persisted_tags = []

    pc_row = pc_repository.upsert_pc(
        pc_id=normalized_id,
        name=normalized_name,
        mac_address=normalize_mac_address(mac_address),
        ip_address=ip_address.strip() if ip_address else None,
        tags_json=json.dumps([tag.strip() for tag in persisted_tags if tag.strip()]),
        note=persisted_note.strip() if isinstance(persisted_note, str) and persisted_note.strip() else None,
        status=persisted_status,
        last_seen_at=persisted_last_seen_at,
        broadcast_ip=broadcast_ip.strip() if broadcast_ip else None,
        send_interface=_normalize_interface_name(send_interface),
        wol_port=wol_port,
        status_method=normalized_status_method,
        status_port=normalized_status_port,
    )

    insert_log(
        action="pc_upsert",
        pc_id=normalized_id,
        status="ok",
        message="pc configuration saved",
    )

    return pc_row


def delete_pc(pc_id: str) -> PcDeletedResult:
    normalized_id = pc_id.strip()
    if not normalized_id:
        raise ValueError("id is required")

    deleted = pc_repository.delete_pc_by_id(normalized_id)
    if not deleted:
        message = f"pc not found: {normalized_id}"
        insert_log(
            action="pc_delete",
            pc_id=normalized_id,
            status="failed",
            message=message,
        )
        raise LookupError(message)

    insert_log(
        action="pc_delete",
        pc_id=normalized_id,
        status="ok",
        message="pc deleted",
    )
    return {"id": normalized_id}


def update_runtime_status(pc_id: str, status: str, mark_seen: bool = False) -> PcRow | None:
    normalized_id = pc_id.strip()
    if not normalized_id:
        raise ValueError("id is required")
    if status not in STATUS_VALUES:
        raise ValueError(f"status must be one of: {', '.join(sorted(STATUS_VALUES))}")

    seen_at = datetime.now(timezone.utc).isoformat() if mark_seen else None
    return pc_repository.update_pc_status(normalized_id, status=status, last_seen_at=seen_at)
