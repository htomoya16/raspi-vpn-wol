from __future__ import annotations

import ipaddress

import pytest

from app.services import wol_service


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


def test_wol_service_error_paths(monkeypatch: pytest.MonkeyPatch) -> None:
    logs: list[dict[str, object]] = []

    def _capture_log(**kwargs: object) -> None:
        logs.append(dict(kwargs))

    monkeypatch.setattr(wol_service, "insert_log", _capture_log)
    monkeypatch.setattr(wol_service.pc_repository, "get_pc_by_id", lambda _: None)

    with pytest.raises(ValueError, match="pc_id is required"):
        wol_service.send_wol("   ")
    with pytest.raises(ValueError, match="pc not found"):
        wol_service.send_wol("pc-missing")

    monkeypatch.setattr(
        wol_service.pc_repository,
        "get_pc_by_id",
        lambda _: _pc_row(ip_address="192.168.10.50", wol_port=99999),
    )
    with pytest.raises(ValueError, match="invalid wol_port"):
        wol_service.send_wol("pc-1")

    monkeypatch.setattr(
        wol_service.pc_repository,
        "get_pc_by_id",
        lambda _: _pc_row(ip_address="192.168.10.50", wol_port=9, send_interface="eth0"),
    )
    monkeypatch.setattr(
        wol_service,
        "_get_interface_ipv4_config",
        lambda _: ("192.168.10.1", "192.168.10.255", ipaddress.ip_network("192.168.10.0/24")),
    )

    with pytest.raises(ValueError, match="invalid broadcast_ip"):
        wol_service.send_wol("pc-1", broadcast_ip_override="not-an-ip")

    monkeypatch.setattr(
        wol_service.pc_repository,
        "get_pc_by_id",
        lambda _: _pc_row(ip_address="10.0.0.9", wol_port=9, send_interface="eth0"),
    )
    with pytest.raises(ValueError, match="outside interface network"):
        wol_service.send_wol("pc-1")

    assert any(log["status"] == "failed" for log in logs)


def test_wol_service_success_path(monkeypatch: pytest.MonkeyPatch) -> None:
    logs: list[dict[str, object]] = []
    sent: dict[str, object] = {}

    def _capture_log(**kwargs: object) -> None:
        logs.append(dict(kwargs))

    def _capture_send(
        mac_address: str,
        broadcast_ip: str,
        wol_port: int,
        source_ip: str,
    ) -> None:
        sent["mac"] = mac_address
        sent["broadcast"] = broadcast_ip
        sent["port"] = wol_port
        sent["source_ip"] = source_ip

    monkeypatch.setattr(wol_service, "insert_log", _capture_log)
    monkeypatch.setattr(
        wol_service.pc_repository,
        "get_pc_by_id",
        lambda _: _pc_row(ip_address="192.168.10.10", wol_port=9, send_interface="eth0"),
    )
    monkeypatch.setattr(
        wol_service,
        "_get_interface_ipv4_config",
        lambda _: ("192.168.10.2", "192.168.10.255", ipaddress.ip_network("192.168.10.0/24")),
    )
    monkeypatch.setattr(wol_service, "_send_magic_packet", _capture_send)

    result = wol_service.send_wol("pc-1", broadcast_ip_override="192.168.10.255", wol_port_override=7)
    assert "WOL packet sent to pc=pc-1" in result["message"]
    assert sent == {
        "mac": "AA:BB:CC:DD:EE:FF",
        "broadcast": "192.168.10.255",
        "port": 7,
        "source_ip": "192.168.10.2",
    }
    assert logs[-1]["status"] == "sent"
