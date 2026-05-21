from __future__ import annotations

import asyncio

from app.use_cases import status_use_case


def test_refresh_pc_status_publishes_pc_status_event(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def _fake_refresh_pc_status(pc_id: str) -> dict[str, object]:
        captured["pc_id"] = pc_id
        return {
            "id": pc_id,
            "status": "online",
            "updated_at": "2026-03-03T00:00:00+00:00",
            "last_seen_at": "2026-03-03T00:00:00+00:00",
        }

    async def _fake_publish(event_type: str, event_payload: dict[str, object]) -> None:
        captured["event_type"] = event_type
        captured["event_payload"] = event_payload

    monkeypatch.setattr(status_use_case.pc_service, "refresh_pc_status", _fake_refresh_pc_status)
    monkeypatch.setattr(status_use_case.event_service.event_broker, "publish", _fake_publish)

    pc = asyncio.run(status_use_case.refresh_pc_status("pc-status"))

    assert pc["id"] == "pc-status"
    assert captured["pc_id"] == "pc-status"
    assert captured["event_type"] == "pc_status"
    assert captured["event_payload"] == {
        "pc_id": "pc-status",
        "status": "online",
        "updated_at": "2026-03-03T00:00:00+00:00",
        "last_seen_at": "2026-03-03T00:00:00+00:00",
    }


def test_request_refresh_all_statuses_creates_task_when_job_created(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def _fake_create_or_get_active_job(
        job_type: str,
        payload: dict[str, object] | None,
    ) -> tuple[dict[str, object], bool]:
        captured["job_type"] = job_type
        captured["payload"] = payload
        return {"id": "job-status-test", "state": "queued"}, True

    async def _fake_run_job(*_: object, **__: object) -> None:
        return None

    def _fake_refresh_all_statuses() -> dict[str, int]:
        return {"total": 0, "succeeded": 0, "failed": 0}

    async def _fake_publish(event_type: str, event_payload: dict[str, object]) -> None:
        captured["event_type"] = event_type
        captured["event_payload"] = event_payload

    def _fake_create_task(coro: object) -> object:
        if hasattr(coro, "close"):
            coro.close()
        captured["task_created"] = True
        return object()

    monkeypatch.setattr(status_use_case.job_service, "create_or_get_active_job", _fake_create_or_get_active_job)
    monkeypatch.setattr(status_use_case.job_service, "run_job", _fake_run_job)
    monkeypatch.setattr(status_use_case.pc_service, "refresh_all_statuses", _fake_refresh_all_statuses)
    monkeypatch.setattr(status_use_case.event_service.event_broker, "publish", _fake_publish)
    monkeypatch.setattr(status_use_case.asyncio, "create_task", _fake_create_task)

    job = asyncio.run(status_use_case.request_refresh_all_statuses())

    assert job == {"id": "job-status-test", "state": "queued"}
    assert captured["job_type"] == "status_refresh_all"
    assert captured["payload"] is None
    assert captured["task_created"] is True
    assert captured["event_type"] == "job"
    assert captured["event_payload"] == {"job_id": "job-status-test", "state": "queued"}


def test_request_refresh_all_statuses_reuses_active_job_without_task(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def _fake_create_or_get_active_job(
        job_type: str,
        payload: dict[str, object] | None,
    ) -> tuple[dict[str, object], bool]:
        return {"id": "job-existing", "state": "running"}, False

    def _unexpected_create_task(_: object) -> object:
        captured["task_created"] = True
        return object()

    async def _unexpected_publish(*_: object, **__: object) -> None:
        captured["event_published"] = True

    monkeypatch.setattr(status_use_case.job_service, "create_or_get_active_job", _fake_create_or_get_active_job)
    monkeypatch.setattr(status_use_case.asyncio, "create_task", _unexpected_create_task)
    monkeypatch.setattr(status_use_case.event_service.event_broker, "publish", _unexpected_publish)

    job = asyncio.run(status_use_case.request_refresh_all_statuses())

    assert job == {"id": "job-existing", "state": "running"}
    assert "task_created" not in captured
    assert "event_published" not in captured
