from __future__ import annotations

from fastapi.testclient import TestClient


def test_wol_endpoint_builds_job_payload_with_overrides(client: TestClient, monkeypatch) -> None:
    import app.api.pcs as pcs_api

    captured: dict[str, object] = {}

    def _fake_get_pc(pc_id: str) -> dict[str, object]:
        return {"id": pc_id}

    def _fake_create_job(job_type: str, payload: dict[str, object] | None) -> dict[str, object]:
        captured["job_type"] = job_type
        captured["payload"] = payload
        return {"id": "job-wol-test", "state": "queued"}

    async def _fake_run_job(*_: object, **__: object) -> None:
        return None

    async def _fake_publish(*_: object, **__: object) -> None:
        return None

    def _fake_create_task(coro: object) -> object:
        if hasattr(coro, "close"):
            coro.close()  # prevent un-awaited coroutine warnings in tests
        return object()

    monkeypatch.setattr(pcs_api.pc_service, "get_pc", _fake_get_pc)
    monkeypatch.setattr(pcs_api.job_service, "create_job", _fake_create_job)
    monkeypatch.setattr(pcs_api.job_service, "run_job", _fake_run_job)
    monkeypatch.setattr(pcs_api.event_service.event_broker, "publish", _fake_publish)
    monkeypatch.setattr(pcs_api.asyncio, "create_task", _fake_create_task)

    response = client.post(
        "/api/pcs/pc-wol/wol",
        json={"broadcast": "192.168.10.255", "port": 7, "repeat": 3},
    )
    assert response.status_code == 202
    assert response.json() == {"job_id": "job-wol-test", "state": "queued"}
    assert captured["job_type"] == "wol"
    assert captured["payload"] == {
        "pc_id": "pc-wol",
        "repeat": 3,
        "broadcast": "192.168.10.255",
        "port": 7,
    }


def test_wol_endpoint_validation_and_not_found(client: TestClient) -> None:
    invalid_repeat_response = client.post("/api/pcs/pc-any/wol", json={"repeat": 0})
    missing_pc_response = client.post("/api/pcs/pc-any/wol", json={"repeat": 1})

    assert invalid_repeat_response.status_code == 422
    assert missing_pc_response.status_code == 404
