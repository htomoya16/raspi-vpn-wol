from __future__ import annotations

import asyncio

from app.services import event_service, job_service


def test_job_service_run_job_success_and_failure(monkeypatch) -> None:
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
