from __future__ import annotations

import asyncio

import pytest

from app.services import status_monitor_service


def test_status_monitor_enqueue_reuses_active_job(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        status_monitor_service.job_service,
        "create_or_get_active_job",
        lambda *_args, **_kwargs: ({"id": "job-active", "state": "running"}, False),
    )

    job_id = asyncio.run(status_monitor_service.enqueue_status_refresh_all_job())
    assert job_id == "job-active"


def test_status_monitor_enqueue_creates_job_and_publishes(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        status_monitor_service.job_service,
        "create_or_get_active_job",
        lambda *_args, **_kwargs: ({"id": "job-new", "state": "queued"}, True),
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
