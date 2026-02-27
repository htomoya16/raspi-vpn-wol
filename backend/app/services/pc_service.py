from __future__ import annotations

import json
import re
import time
from sqlite3 import IntegrityError
from datetime import datetime, timezone
from uuid import uuid4

from app.models.pcs import PcCreate, PcStatus, PcUpdate
from app.repositories import pc_repository
from app.services import pc_registry_service, status_service, uptime_service, wol_service
from app.types import PcRow

STATUS_VALUES: set[PcStatus] = {"online", "offline", "unknown", "booting", "unreachable"}
BOOTING_POLL_INTERVAL_SECONDS = 3
BOOTING_POLL_MAX_ATTEMPTS = 20


class PcConflictError(ValueError):
    pass


def _ensure_mac_unique(mac_address: str, exclude_pc_id: str | None = None) -> None:
    normalized_mac = pc_registry_service.normalize_mac_address(mac_address)
    existing = pc_repository.get_pc_by_mac(normalized_mac)
    if existing is None:
        return
    if exclude_pc_id is not None and existing["id"] == exclude_pc_id:
        return
    raise PcConflictError(f"既に存在しています（MAC: {normalized_mac}）")


def _normalize_generated_id(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-")
    if not slug:
        slug = "pc"
    return f"{slug}-{uuid4().hex[:6]}"


def _generate_unique_pc_id(name: str) -> str:
    for _ in range(10):
        candidate = _normalize_generated_id(name)
        if pc_repository.get_pc_by_id(candidate) is None:
            return candidate
    raise ValueError("failed to generate unique pc id")


def _parse_tags(tags_json: str) -> list[str]:
    try:
        parsed = json.loads(tags_json)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    tags: list[str] = []
    for value in parsed:
        if isinstance(value, str):
            stripped = value.strip()
            if stripped:
                tags.append(stripped)
    return tags


def _row_to_pc(pc_row: PcRow) -> dict[str, object]:
    status_value = str(pc_row.get("status") or "unknown")
    if status_value not in STATUS_VALUES:
        status_value = "unknown"
    return {
        "id": pc_row["id"],
        "name": pc_row["name"],
        "mac": pc_row["mac_address"],
        "ip": pc_row["ip_address"],
        "tags": _parse_tags(pc_row.get("tags_json", "[]")),
        "note": pc_row.get("note"),
        "status": status_value,
        "last_seen_at": pc_row.get("last_seen_at"),
        "created_at": pc_row["created_at"],
        "updated_at": pc_row["updated_at"],
    }


def list_pcs(
    q: str | None,
    status: PcStatus | None,
    tag: str | None,
    limit: int,
    cursor: str | None,
) -> tuple[list[dict[str, object]], str | None]:
    normalized_q = q.strip() if q else None
    normalized_tag = tag.strip() if tag else None
    normalized_cursor = cursor.strip() if cursor else None

    rows = pc_repository.list_pcs(
        q=normalized_q or None,
        status=status,
        tag=normalized_tag or None,
        cursor=normalized_cursor or None,
        limit=limit + 1,
    )
    pcs = [_row_to_pc(row) for row in rows]

    has_more = len(pcs) > limit
    page = pcs[:limit]
    next_cursor = str(page[-1]["id"]) if has_more and page else None
    return page, next_cursor


def get_pc(pc_id: str) -> dict[str, object]:
    normalized_id = pc_id.strip()
    if not normalized_id:
        raise ValueError("pc_id is required")
    row = pc_repository.get_pc_by_id(normalized_id)
    if row is None:
        raise LookupError(f"pc not found: {normalized_id}")
    return _row_to_pc(row)


def create_pc(payload: PcCreate) -> dict[str, object]:
    requested_id = payload.id.strip() if payload.id else ""
    if requested_id:
        if pc_repository.get_pc_by_id(requested_id) is not None:
            raise PcConflictError(f"既に存在しています（ID: {requested_id}）")
        pc_id = requested_id
    else:
        pc_id = _generate_unique_pc_id(payload.name)

    _ensure_mac_unique(payload.mac)

    try:
        pc_row = pc_registry_service.upsert_pc(
            pc_id=pc_id,
            name=payload.name,
            mac_address=payload.mac,
            ip_address=payload.ip,
            tags=payload.tags,
            note=payload.note,
            status="unknown",
        )
    except IntegrityError as exc:
        if "uq_pcs_mac_address" in str(exc) or "pcs.mac_address" in str(exc):
            normalized_mac = pc_registry_service.normalize_mac_address(payload.mac)
            raise PcConflictError(f"既に存在しています（MAC: {normalized_mac}）") from exc
        raise
    return _row_to_pc(pc_row)


def update_pc(pc_id: str, payload: PcUpdate) -> dict[str, object]:
    existing = pc_repository.get_pc_by_id(pc_id.strip())
    if existing is None:
        raise LookupError(f"pc not found: {pc_id}")
    patch = payload.model_dump(exclude_unset=True)
    next_mac = patch["mac"] if "mac" in patch else existing["mac_address"]
    _ensure_mac_unique(str(next_mac), exclude_pc_id=existing["id"])

    try:
        pc_row = pc_registry_service.upsert_pc(
            pc_id=existing["id"],
            name=patch["name"] if "name" in patch else existing["name"],
            mac_address=patch["mac"] if "mac" in patch else existing["mac_address"],
            ip_address=patch["ip"] if "ip" in patch else existing["ip_address"],
            tags=patch["tags"] if "tags" in patch else _parse_tags(existing.get("tags_json", "[]")),
            note=patch["note"] if "note" in patch else existing.get("note"),
            status=str(existing.get("status") or "unknown"),
            last_seen_at=existing.get("last_seen_at"),
            broadcast_ip=existing.get("broadcast_ip"),
            send_interface=existing.get("send_interface"),
            wol_port=int(existing.get("wol_port") or 9),
            status_method=existing.get("status_method"),
            status_port=int(existing.get("status_port") or 445),
        )
    except IntegrityError as exc:
        if "uq_pcs_mac_address" in str(exc) or "pcs.mac_address" in str(exc):
            normalized_mac = pc_registry_service.normalize_mac_address(str(next_mac))
            raise PcConflictError(f"既に存在しています（MAC: {normalized_mac}）") from exc
        raise
    return _row_to_pc(pc_row)


def delete_pc(pc_id: str) -> None:
    pc_registry_service.delete_pc(pc_id)


def refresh_pc_status(pc_id: str) -> dict[str, object]:
    existing = pc_repository.get_pc_by_id(pc_id.strip())
    if existing is None:
        raise LookupError(f"pc not found: {pc_id}")
    try:
        result = status_service.get_pc_status(pc_id)
        status_value = str(result["status"])
    except ValueError:
        status_value = "unreachable"
    if status_value not in STATUS_VALUES:
        status_value = "unreachable"
    normalized_status = status_value if status_value in STATUS_VALUES else "unreachable"
    pc_registry_service.update_runtime_status(
        pc_id,
        status=normalized_status,
        mark_seen=normalized_status == "online",
    )
    return get_pc(pc_id)


def refresh_all_statuses() -> dict[str, int]:
    rows = pc_repository.list_pcs()
    total = len(rows)
    succeeded = 0
    failed = 0
    for row in rows:
        pc_id = row["id"]
        try:
            refresh_pc_status(pc_id)
            succeeded += 1
        except ValueError:
            pc_registry_service.update_runtime_status(pc_id, status="unreachable", mark_seen=False)
            failed += 1
    return {"total": total, "succeeded": succeeded, "failed": failed}


def send_wol(
    pc_id: str,
    repeat: int = 1,
    broadcast: str | None = None,
    port: int | None = None,
) -> dict[str, object]:
    current = pc_repository.get_pc_by_id(pc_id.strip())
    had_seen_before = bool(current and current.get("last_seen_at"))

    normalized_repeat = repeat if repeat > 0 else 1
    message = ""
    for _ in range(normalized_repeat):
        result = wol_service.send_wol(
            pc_id=pc_id,
            broadcast_ip_override=broadcast,
            wol_port_override=port,
        )
        message = result["message"]

    pc_registry_service.update_runtime_status(pc_id, status="booting", mark_seen=False)
    now_iso = datetime.now(timezone.utc).isoformat()

    attempts = 0
    for attempt in range(BOOTING_POLL_MAX_ATTEMPTS):
        attempts = attempt + 1
        time.sleep(BOOTING_POLL_INTERVAL_SECONDS)
        try:
            probe = status_service.get_pc_status(pc_id)
            probe_status = str(probe["status"])
        except ValueError:
            pc_registry_service.update_runtime_status(pc_id, status="unreachable", mark_seen=False)
            return {
                "message": message,
                "requested_at": now_iso,
                "final_status": "unreachable",
                "poll_interval_seconds": BOOTING_POLL_INTERVAL_SECONDS,
                "poll_attempts": attempts,
            }

        if probe_status == "online":
            pc_registry_service.update_runtime_status(pc_id, status="online", mark_seen=True)
            return {
                "message": message,
                "requested_at": now_iso,
                "final_status": "online",
                "poll_interval_seconds": BOOTING_POLL_INTERVAL_SECONDS,
                "poll_attempts": attempts,
            }

    final_status: PcStatus = "offline" if had_seen_before else "unknown"
    pc_registry_service.update_runtime_status(pc_id, status=final_status, mark_seen=False)
    return {
        "message": message,
        "requested_at": now_iso,
        "final_status": final_status,
        "poll_interval_seconds": BOOTING_POLL_INTERVAL_SECONDS,
        "poll_attempts": attempts,
    }


def get_uptime_summary(
    *,
    pc_id: str,
    from_date: str | None,
    to_date: str | None,
    bucket: str,
    tz: str | None,
) -> dict[str, object]:
    return uptime_service.get_pc_uptime_summary(
        pc_id=pc_id,
        from_date=from_date,
        to_date=to_date,
        bucket=bucket,
        tz_name=tz,
    )


def get_weekly_timeline(
    *,
    pc_id: str,
    week_start: str | None,
    tz: str | None,
) -> dict[str, object]:
    return uptime_service.get_pc_weekly_timeline(
        pc_id=pc_id,
        week_start=week_start,
        tz_name=tz,
    )
