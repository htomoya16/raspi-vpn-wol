from __future__ import annotations

from fastapi.testclient import TestClient


def _assert_retry_after_header(response) -> None:
    assert response.status_code == 429
    assert "retry-after" in response.headers
    assert int(response.headers["retry-after"]) >= 1


def test_wol_endpoint_rate_limit_returns_429(client: TestClient, monkeypatch) -> None:
    import app.api.pcs as pcs_api

    def _fake_get_pc(pc_id: str) -> dict[str, object]:
        return {"id": pc_id}

    def _fake_create_job(*_: object, **__: object) -> dict[str, object]:
        return {"id": "job-rate-wol", "state": "queued"}

    async def _fake_run_job(*_: object, **__: object) -> None:
        return None

    async def _fake_publish(*_: object, **__: object) -> None:
        return None

    def _fake_create_task(coro: object) -> object:
        if hasattr(coro, "close"):
            coro.close()
        return object()

    monkeypatch.setattr(pcs_api.pc_service, "get_pc", _fake_get_pc)
    monkeypatch.setattr(pcs_api.job_service, "create_job", _fake_create_job)
    monkeypatch.setattr(pcs_api.job_service, "run_job", _fake_run_job)
    monkeypatch.setattr(pcs_api.event_service.event_broker, "publish", _fake_publish)
    monkeypatch.setattr(pcs_api.asyncio, "create_task", _fake_create_task)

    for _ in range(3):
        response = client.post("/api/pcs/pc-main/wol", json={"repeat": 1})
        assert response.status_code == 202

    limited = client.post("/api/pcs/pc-main/wol", json={"repeat": 1})
    _assert_retry_after_header(limited)


def test_refresh_pc_endpoint_rate_limit_returns_429(client: TestClient, monkeypatch) -> None:
    import app.api.pcs as pcs_api

    sample_pc = {
        "id": "pc-main",
        "name": "Main",
        "mac": "AA:BB:CC:DD:EE:10",
        "ip": "192.168.10.20",
        "tags": [],
        "note": None,
        "status": "online",
        "last_seen_at": "2026-03-03T01:02:03+00:00",
        "created_at": "2026-03-03T01:00:00+00:00",
        "updated_at": "2026-03-03T01:02:03+00:00",
    }

    def _fake_refresh_pc_status(_: str) -> dict[str, object]:
        return sample_pc

    async def _fake_publish(*_: object, **__: object) -> None:
        return None

    monkeypatch.setattr(pcs_api.pc_service, "refresh_pc_status", _fake_refresh_pc_status)
    monkeypatch.setattr(pcs_api.event_service.event_broker, "publish", _fake_publish)

    for _ in range(6):
        response = client.post("/api/pcs/pc-main/status/refresh")
        assert response.status_code == 200

    limited = client.post("/api/pcs/pc-main/status/refresh")
    _assert_retry_after_header(limited)


def test_refresh_all_endpoint_rate_limit_returns_429(client: TestClient, monkeypatch) -> None:
    import app.api.pcs as pcs_api

    def _fake_create_or_get_active_job(*_: object, **__: object) -> tuple[dict[str, object], bool]:
        return {"id": "job-rate-refresh-all", "state": "queued"}, True

    async def _fake_run_job(*_: object, **__: object) -> None:
        return None

    async def _fake_publish(*_: object, **__: object) -> None:
        return None

    def _fake_create_task(coro: object) -> object:
        if hasattr(coro, "close"):
            coro.close()
        return object()

    monkeypatch.setattr(pcs_api.job_service, "create_or_get_active_job", _fake_create_or_get_active_job)
    monkeypatch.setattr(pcs_api.job_service, "run_job", _fake_run_job)
    monkeypatch.setattr(pcs_api.event_service.event_broker, "publish", _fake_publish)
    monkeypatch.setattr(pcs_api.asyncio, "create_task", _fake_create_task)

    first = client.post("/api/pcs/status/refresh")
    assert first.status_code == 202

    second = client.post("/api/pcs/status/refresh")
    _assert_retry_after_header(second)


def test_admin_write_endpoint_rate_limit_returns_429(client: TestClient) -> None:
    for index in range(10):
        response = client.post(
            "/api/admin/tokens",
            json={"name": f"rate-token-{index}", "role": "device", "expires_at": None},
        )
        assert response.status_code == 201

    limited = client.post(
        "/api/admin/tokens",
        json={"name": "rate-token-over", "role": "device", "expires_at": None},
    )
    _assert_retry_after_header(limited)
