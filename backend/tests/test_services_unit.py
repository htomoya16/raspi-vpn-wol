from __future__ import annotations

import asyncio
import ipaddress
import socket
from types import SimpleNamespace

import pytest

from app.services import (
    event_service,
    job_service,
    pc_registry_service,
    pc_service,
    status_monitor_service,
    status_service,
    wol_service,
)


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


def test_pc_registry_validation_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(pc_registry_service.pc_repository, "get_pc_by_id", lambda _: None)

    with pytest.raises(ValueError, match="status_method must be 'tcp' or 'ping'"):
        pc_registry_service.upsert_pc("pc-a", "A", "AA:BB:CC:DD:EE:01", status_method="icmp")

    with pytest.raises(ValueError, match="wg interfaces are not allowed for WOL"):
        pc_registry_service.upsert_pc("pc-a", "A", "AA:BB:CC:DD:EE:01", send_interface="wg0")

    with pytest.raises(ValueError, match="status must be one of"):
        pc_registry_service.upsert_pc("pc-a", "A", "AA:BB:CC:DD:EE:01", status="broken")


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


def test_job_service_run_job_success_and_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    states: list[tuple[str, object]] = []
    events: list[tuple[str, dict[str, object]]] = []

    monkeypatch.setattr(job_service.job_repository, "mark_running", lambda job_id: states.append(("running", job_id)))
    monkeypatch.setattr(
        job_service.job_repository,
        "mark_succeeded",
        lambda job_id, result_json: states.append(("succeeded", result_json)),
    )
    monkeypatch.setattr(
        job_service.job_repository,
        "mark_failed",
        lambda job_id, error_message: states.append(("failed", error_message)),
    )

    async def _publish(event: str, data: dict[str, object]) -> None:
        events.append((event, data))

    monkeypatch.setattr(job_service.event_service.event_broker, "publish", _publish)

    asyncio.run(job_service.run_job("job-success", lambda: {"ok": True}))
    assert states[0] == ("running", "job-success")
    assert states[1][0] == "succeeded"
    assert events[-1] == ("job", {"job_id": "job-success", "state": "succeeded"})

    states.clear()
    events.clear()

    def _raise() -> None:
        raise RuntimeError("boom")

    asyncio.run(job_service.run_job("job-failed", _raise))
    assert states[0] == ("running", "job-failed")
    assert states[1][0] == "failed"
    assert "boom" in str(states[1][1])
    assert events[-1][1]["state"] == "failed"


def test_event_broker_stream_receives_published_event() -> None:
    async def _run_case() -> str:
        broker = event_service.EventBroker()
        stream = broker.stream()
        waiter = asyncio.create_task(stream.__anext__())
        await asyncio.sleep(0)
        await broker.publish("pc_status", {"pc_id": "pc-1", "status": "online"})
        message = await asyncio.wait_for(waiter, timeout=1.0)
        await stream.aclose()
        return message

    message = asyncio.run(_run_case())
    assert "event: pc_status" in message
    assert "\"pc_id\": \"pc-1\"" in message


def test_status_monitor_enqueue_reuses_active_job(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        status_monitor_service.job_service,
        "get_active_job_by_type",
        lambda _: {"id": "job-active"},
    )
    monkeypatch.setattr(
        status_monitor_service.job_service,
        "create_job",
        lambda *args, **kwargs: pytest.fail("create_job should not be called"),
    )

    job_id = asyncio.run(status_monitor_service.enqueue_status_refresh_all_job())
    assert job_id == "job-active"


def test_status_monitor_enqueue_creates_job_and_publishes(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        status_monitor_service.job_service,
        "get_active_job_by_type",
        lambda _: None,
    )
    monkeypatch.setattr(
        status_monitor_service.job_service,
        "create_job",
        lambda *args, **kwargs: {"id": "job-new", "state": "queued"},
    )

    async def _run_job(*args: object, **kwargs: object) -> None:
        return None

    monkeypatch.setattr(status_monitor_service.job_service, "run_job", _run_job)

    created_coroutines: list[object] = []

    class _DummyTask:
        def cancel(self) -> None:
            return None

    def _create_task(coro: object) -> _DummyTask:
        created_coroutines.append(coro)
        return _DummyTask()

    monkeypatch.setattr(status_monitor_service.asyncio, "create_task", _create_task)

    published: list[tuple[str, dict[str, object]]] = []

    async def _publish(event: str, data: dict[str, object]) -> None:
        published.append((event, data))

    monkeypatch.setattr(status_monitor_service.event_service.event_broker, "publish", _publish)

    job_id = asyncio.run(status_monitor_service.enqueue_status_refresh_all_job())
    assert job_id == "job-new"
    assert published == [("job", {"job_id": "job-new", "state": "queued"})]
    assert len(created_coroutines) == 1

    for coro in created_coroutines:
        close = getattr(coro, "close", None)
        if callable(close):
            close()


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
