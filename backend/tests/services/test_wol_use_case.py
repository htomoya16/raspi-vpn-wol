from __future__ import annotations

import asyncio

from app.models.wol import WolRequest
from app.use_cases import wol_use_case


def test_request_wol_creates_job_payload_with_overrides(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def _fake_get_pc(pc_id: str) -> dict[str, object]:
        captured["pc_id"] = pc_id
        return {"id": pc_id}

    def _fake_create_job(job_type: str, payload: dict[str, object] | None) -> dict[str, object]:
        captured["job_type"] = job_type
        captured["payload"] = payload
        return {"id": "job-wol-test", "state": "queued"}

    async def _fake_run_job(*_: object, **__: object) -> None:
        return None

    async def _fake_publish(event_type: str, event_payload: dict[str, object]) -> None:
        captured["event_type"] = event_type
        captured["event_payload"] = event_payload

    def _fake_create_task(coro: object) -> object:
        if hasattr(coro, "close"):
            coro.close()
        captured["task_created"] = True
        return object()

    monkeypatch.setattr(wol_use_case.pc_service, "get_pc", _fake_get_pc)
    monkeypatch.setattr(wol_use_case.job_service, "create_job", _fake_create_job)
    monkeypatch.setattr(wol_use_case.job_service, "run_job", _fake_run_job)
    monkeypatch.setattr(wol_use_case.event_service.event_broker, "publish", _fake_publish)
    monkeypatch.setattr(wol_use_case.asyncio, "create_task", _fake_create_task)

    job = asyncio.run(
        wol_use_case.request_wol(
            "pc-wol",
            WolRequest(broadcast="192.168.10.255", port=7, repeat=3),
        )
    )

    assert job == {"id": "job-wol-test", "state": "queued"}
    assert captured["pc_id"] == "pc-wol"
    assert captured["job_type"] == "wol"
    assert captured["payload"] == {
        "pc_id": "pc-wol",
        "repeat": 3,
        "broadcast": "192.168.10.255",
        "port": 7,
    }
    assert captured["task_created"] is True
    assert captured["event_type"] == "job"
    assert captured["event_payload"] == {"job_id": "job-wol-test", "state": "queued"}
