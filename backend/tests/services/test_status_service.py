from __future__ import annotations

import socket
from types import SimpleNamespace

import pytest

from app.services import status_service


def _pc_row(**overrides: object) -> dict[str, object]:
    row: dict[str, object] = {
        "id": "pc-1",
        "name": "PC One",
        "mac_address": "AA:BB:CC:DD:EE:FF",
        "ip_address": "192.168.10.10",
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


def test_status_service_missing_pc_and_required_id(monkeypatch: pytest.MonkeyPatch) -> None:
    logs: list[dict[str, object]] = []

    def _capture_log(**kwargs: object) -> None:
        logs.append(dict(kwargs))

    monkeypatch.setattr(status_service, "insert_log", _capture_log)
    monkeypatch.setattr(status_service.pc_repository, "get_pc_by_id", lambda _: None)

    with pytest.raises(ValueError, match="pc_id is required"):
        status_service.get_pc_status("   ")

    with pytest.raises(ValueError, match="pc not found"):
        status_service.get_pc_status("pc-missing")

    assert logs[-1]["action"] == "status"
    assert logs[-1]["status"] == "failed"


def test_status_service_tcp_online_and_offline(monkeypatch: pytest.MonkeyPatch) -> None:
    logs: list[dict[str, object]] = []

    def _capture_log(**kwargs: object) -> None:
        logs.append(dict(kwargs))

    monkeypatch.setattr(status_service, "insert_log", _capture_log)
    monkeypatch.setattr(
        status_service.pc_repository,
        "get_pc_by_id",
        lambda _: _pc_row(ip_address="192.168.10.10", status_method="tcp", status_port=445),
    )

    class _SocketCtx:
        def __enter__(self) -> "_SocketCtx":
            return self

        def __exit__(self, exc_type: object, exc: object, tb: object) -> bool:
            return False

    monkeypatch.setattr(status_service.socket, "create_connection", lambda *args, **kwargs: _SocketCtx())
    online = status_service.get_pc_status("pc-1")
    assert online == {"pc_id": "pc-1", "status": "online"}

    def _raise_timeout(*args: object, **kwargs: object) -> _SocketCtx:
        raise socket.timeout("timeout")

    monkeypatch.setattr(status_service.socket, "create_connection", _raise_timeout)
    offline = status_service.get_pc_status("pc-1")
    assert offline == {"pc_id": "pc-1", "status": "offline"}

    assert any(log["status"] == "online" for log in logs)
    assert any(log["status"] == "offline" for log in logs)


def test_status_service_ping_paths(monkeypatch: pytest.MonkeyPatch) -> None:
    logs: list[dict[str, object]] = []

    def _capture_log(**kwargs: object) -> None:
        logs.append(dict(kwargs))

    monkeypatch.setattr(status_service, "insert_log", _capture_log)
    monkeypatch.setattr(
        status_service.pc_repository,
        "get_pc_by_id",
        lambda _: _pc_row(ip_address="192.168.10.11", status_method="ping"),
    )

    monkeypatch.setattr(
        status_service.subprocess,
        "run",
        lambda *args, **kwargs: SimpleNamespace(returncode=0),
    )
    online = status_service.get_pc_status("pc-1")
    assert online["status"] == "online"

    monkeypatch.setattr(
        status_service.subprocess,
        "run",
        lambda *args, **kwargs: SimpleNamespace(returncode=1),
    )
    offline = status_service.get_pc_status("pc-1")
    assert offline["status"] == "offline"

    def _raise_not_found(*args: object, **kwargs: object) -> SimpleNamespace:
        raise FileNotFoundError("missing ping")

    monkeypatch.setattr(status_service.subprocess, "run", _raise_not_found)
    with pytest.raises(ValueError, match="ping command is not available"):
        status_service.get_pc_status("pc-1")

    assert any(log["status"] == "failed" for log in logs)


def test_status_service_raises_when_ip_is_not_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    logs: list[dict[str, object]] = []

    def _capture_log(**kwargs: object) -> None:
        logs.append(dict(kwargs))

    monkeypatch.setattr(status_service, "insert_log", _capture_log)
    monkeypatch.setattr(
        status_service.pc_repository,
        "get_pc_by_id",
        lambda _: _pc_row(ip_address=None),
    )

    with pytest.raises(ValueError, match="ip_address is required for pc"):
        status_service.get_pc_status("pc-1")
    assert logs[-1]["status"] == "failed"
