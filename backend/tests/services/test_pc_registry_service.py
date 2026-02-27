from __future__ import annotations

import pytest
from datetime import datetime
from zoneinfo import ZoneInfo

from app.services import pc_registry_service


def test_pc_registry_validation_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(pc_registry_service.pc_repository, "get_pc_by_id", lambda _: None)

    with pytest.raises(ValueError, match="status_method must be 'tcp' or 'ping'"):
        pc_registry_service.upsert_pc("pc-a", "A", "AA:BB:CC:DD:EE:01", status_method="icmp")

    with pytest.raises(ValueError, match="wg interfaces are not allowed for WOL"):
        pc_registry_service.upsert_pc("pc-a", "A", "AA:BB:CC:DD:EE:01", send_interface="wg0")

    with pytest.raises(ValueError, match="status must be one of"):
        pc_registry_service.upsert_pc("pc-a", "A", "AA:BB:CC:DD:EE:01", status="broken")


def test_update_runtime_status_records_transition_when_status_changes(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        pc_registry_service.pc_repository,
        "get_pc_by_id",
        lambda _pc_id: {"id": "pc-1", "status": "unknown"},
    )

    transition_calls: list[dict[str, object]] = []

    def _capture_transition(**kwargs: object) -> bool:
        transition_calls.append(kwargs)
        return True

    monkeypatch.setattr(
        pc_registry_service.uptime_service,
        "record_status_transition",
        _capture_transition,
    )

    update_calls: list[tuple[str, str, str | None]] = []

    def _capture_update(pc_id: str, status: str, last_seen_at: str | None = None) -> dict[str, object]:
        update_calls.append((pc_id, status, last_seen_at))
        return {"id": pc_id, "status": status, "last_seen_at": last_seen_at}

    monkeypatch.setattr(
        pc_registry_service.pc_repository,
        "update_pc_status",
        _capture_update,
    )

    result = pc_registry_service.update_runtime_status("pc-1", "online", mark_seen=True)

    assert result is not None
    assert len(transition_calls) == 1
    assert transition_calls[0]["pc_id"] == "pc-1"
    assert transition_calls[0]["previous_status"] == "unknown"
    assert transition_calls[0]["next_status"] == "online"
    assert transition_calls[0]["source"] == "runtime"

    assert len(update_calls) == 1
    assert update_calls[0][0] == "pc-1"
    assert update_calls[0][1] == "online"
    assert update_calls[0][2] is not None
    datetime.fromisoformat(str(update_calls[0][2])).astimezone(ZoneInfo("UTC"))


def test_update_runtime_status_skips_transition_when_status_is_same(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        pc_registry_service.pc_repository,
        "get_pc_by_id",
        lambda _pc_id: {"id": "pc-1", "status": "offline"},
    )

    monkeypatch.setattr(
        pc_registry_service.uptime_service,
        "record_status_transition",
        lambda **_: pytest.fail("record_status_transition should not be called"),
    )

    monkeypatch.setattr(
        pc_registry_service.pc_repository,
        "update_pc_status",
        lambda pc_id, status, last_seen_at=None: {
            "id": pc_id,
            "status": status,
            "last_seen_at": last_seen_at,
        },
    )

    result = pc_registry_service.update_runtime_status("pc-1", "offline", mark_seen=False)
    assert result is not None
    assert result["status"] == "offline"
