from __future__ import annotations

import pytest

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
