from __future__ import annotations

import pytest

from app.models.pcs import PcCreate
from app.services import pc_service


def _pc_row(**overrides: object) -> dict[str, object]:
    row: dict[str, object] = {
        "id": "pc-1",
        "name": "PC One",
        "mac_address": "AA:BB:CC:DD:EE:FF",
        "ip_address": None,
        "tags_json": "[]",
        "note": None,
        "status": "unknown",
        "last_seen_at": None,
        "broadcast_ip": None,
        "send_interface": "eth0",
        "wol_port": 9,
        "status_method": "tcp",
        "status_port": 445,
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-01-01T00:00:00+00:00",
    }
    row.update(overrides)
    return row


def test_pc_service_send_wol_polls_every_3_seconds_until_online(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        pc_service.pc_repository,
        "get_pc_by_id",
        lambda _: _pc_row(last_seen_at=None),
    )
    monkeypatch.setattr(
        pc_service.wol_service,
        "send_wol",
        lambda **kwargs: {"message": "sent"},
    )
    monkeypatch.setattr(pc_service.time, "sleep", lambda _: None)
    monkeypatch.setattr(pc_service, "BOOTING_POLL_MAX_ATTEMPTS", 3)

    probes = iter(
        [
            {"pc_id": "pc-1", "status": "offline"},
            {"pc_id": "pc-1", "status": "online"},
        ]
    )
    monkeypatch.setattr(pc_service.status_service, "get_pc_status", lambda _: next(probes))

    updates: list[tuple[str, bool]] = []

    def _capture_update(pc_id: str, status: str, mark_seen: bool = False) -> dict[str, object]:
        assert pc_id == "pc-1"
        updates.append((status, mark_seen))
        return _pc_row(status=status, last_seen_at="2026-01-01T00:00:00+00:00")

    monkeypatch.setattr(pc_service.pc_registry_service, "update_runtime_status", _capture_update)

    result = pc_service.send_wol("pc-1")

    assert result["poll_interval_seconds"] == 3
    assert result["poll_attempts"] == 2
    assert result["final_status"] == "online"
    assert updates == [("booting", False), ("online", True)]


def test_pc_service_send_wol_poll_timeout_marks_offline_or_unknown(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        pc_service.wol_service,
        "send_wol",
        lambda **kwargs: {"message": "sent"},
    )
    monkeypatch.setattr(pc_service.time, "sleep", lambda _: None)
    monkeypatch.setattr(pc_service, "BOOTING_POLL_MAX_ATTEMPTS", 2)
    monkeypatch.setattr(
        pc_service.status_service,
        "get_pc_status",
        lambda _: {"pc_id": "pc-1", "status": "offline"},
    )

    unknown_updates: list[tuple[str, bool]] = []

    monkeypatch.setattr(
        pc_service.pc_repository,
        "get_pc_by_id",
        lambda _: _pc_row(last_seen_at=None),
    )
    monkeypatch.setattr(
        pc_service.pc_registry_service,
        "update_runtime_status",
        lambda _pc_id, status, mark_seen=False: unknown_updates.append((status, mark_seen)) or _pc_row(status=status),
    )
    unknown_result = pc_service.send_wol("pc-1")
    assert unknown_result["final_status"] == "unknown"
    assert unknown_updates[-1] == ("unknown", False)

    offline_updates: list[tuple[str, bool]] = []

    monkeypatch.setattr(
        pc_service.pc_repository,
        "get_pc_by_id",
        lambda _: _pc_row(last_seen_at="2026-01-01T00:00:00+00:00"),
    )
    monkeypatch.setattr(
        pc_service.pc_registry_service,
        "update_runtime_status",
        lambda _pc_id, status, mark_seen=False: offline_updates.append((status, mark_seen)) or _pc_row(status=status),
    )
    offline_result = pc_service.send_wol("pc-1")
    assert offline_result["final_status"] == "offline"
    assert offline_updates[-1] == ("offline", False)


def test_pc_service_send_wol_marks_unreachable_on_status_probe_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        pc_service.pc_repository,
        "get_pc_by_id",
        lambda _: _pc_row(last_seen_at="2026-01-01T00:00:00+00:00"),
    )
    monkeypatch.setattr(
        pc_service.wol_service,
        "send_wol",
        lambda **kwargs: {"message": "sent"},
    )
    monkeypatch.setattr(pc_service.time, "sleep", lambda _: None)
    monkeypatch.setattr(pc_service, "BOOTING_POLL_MAX_ATTEMPTS", 2)

    def _raise_status_error(_: str) -> dict[str, object]:
        raise ValueError("status probe failed")

    monkeypatch.setattr(pc_service.status_service, "get_pc_status", _raise_status_error)

    updates: list[tuple[str, bool]] = []
    monkeypatch.setattr(
        pc_service.pc_registry_service,
        "update_runtime_status",
        lambda _pc_id, status, mark_seen=False: updates.append((status, mark_seen)) or _pc_row(status=status),
    )

    result = pc_service.send_wol("pc-1")

    assert result["final_status"] == "unreachable"
    assert result["poll_attempts"] == 1
    assert updates == [("booting", False), ("unreachable", False)]


def test_list_pcs_uses_memory_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    pc_service.cache.clear()
    call_count = {"list_pcs": 0}

    def _list_pcs(**_: object) -> list[dict[str, object]]:
        call_count["list_pcs"] += 1
        return [_pc_row(id="pc-cache")]

    monkeypatch.setattr(pc_service.pc_repository, "list_pcs", _list_pcs)

    first_items, first_cursor = pc_service.list_pcs(
        q=None,
        status=None,
        tag=None,
        limit=50,
        cursor=None,
    )
    second_items, second_cursor = pc_service.list_pcs(
        q=None,
        status=None,
        tag=None,
        limit=50,
        cursor=None,
    )

    assert call_count["list_pcs"] == 1
    assert first_cursor is None
    assert second_cursor is None
    assert [item["id"] for item in first_items] == ["pc-cache"]
    assert [item["id"] for item in second_items] == ["pc-cache"]


def test_create_pc_invalidates_list_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    pc_service.cache.clear()
    call_count = {"list_pcs": 0}

    def _list_pcs(**_: object) -> list[dict[str, object]]:
        call_count["list_pcs"] += 1
        return [_pc_row(id="pc-before")]

    monkeypatch.setattr(pc_service.pc_repository, "list_pcs", _list_pcs)
    monkeypatch.setattr(pc_service.pc_repository, "get_pc_by_id", lambda _pc_id: None)
    monkeypatch.setattr(pc_service.pc_repository, "get_pc_by_mac", lambda _mac: None)
    monkeypatch.setattr(
        pc_service.pc_registry_service,
        "upsert_pc",
        lambda **kwargs: _pc_row(
            id=kwargs["pc_id"],
            name=kwargs["name"],
            mac_address=kwargs["mac_address"],
        ),
    )

    pc_service.list_pcs(q=None, status=None, tag=None, limit=50, cursor=None)
    pc_service.list_pcs(q=None, status=None, tag=None, limit=50, cursor=None)
    assert call_count["list_pcs"] == 1

    payload = PcCreate(id="pc-new", name="New PC", mac="AA:BB:CC:DD:EE:99")
    created = pc_service.create_pc(payload)
    assert created["id"] == "pc-new"

    pc_service.list_pcs(q=None, status=None, tag=None, limit=50, cursor=None)
    assert call_count["list_pcs"] == 2


def test_get_uptime_summary_uses_memory_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    pc_service.cache.clear()
    call_count = {"summary": 0}

    def _get_summary(**_: object) -> dict[str, object]:
        call_count["summary"] += 1
        return {
            "pc_id": "pc-1",
            "from": "2026-02-01",
            "to": "2026-02-07",
            "bucket": "day",
            "tz": "Asia/Tokyo",
            "items": [],
        }

    monkeypatch.setattr(pc_service.uptime_service, "get_pc_uptime_summary", _get_summary)

    first = pc_service.get_uptime_summary(
        pc_id="pc-1",
        from_date="2026-02-01",
        to_date="2026-02-07",
        bucket="day",
        tz="Asia/Tokyo",
    )
    second = pc_service.get_uptime_summary(
        pc_id="pc-1",
        from_date="2026-02-01",
        to_date="2026-02-07",
        bucket="day",
        tz="Asia/Tokyo",
    )

    assert call_count["summary"] == 1
    assert first["pc_id"] == "pc-1"
    assert second["pc_id"] == "pc-1"
