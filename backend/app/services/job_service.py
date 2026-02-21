from __future__ import annotations

import asyncio
import json
from collections.abc import Callable

from app.repositories import job_repository
from app.services import event_service


def create_job(job_type: str, payload: dict[str, object] | None) -> dict[str, object]:
    payload_json = json.dumps(payload) if payload is not None else None
    row = job_repository.create_job(job_type=job_type, payload_json=payload_json)
    return _to_job(row)


def get_job(job_id: str) -> dict[str, object]:
    normalized_id = job_id.strip()
    if not normalized_id:
        raise ValueError("job_id is required")
    row = job_repository.get_job(normalized_id)
    if row is None:
        raise LookupError(f"job not found: {normalized_id}")
    return _to_job(row)


async def run_job(
    job_id: str,
    runner: Callable[[], object],
) -> None:
    job_repository.mark_running(job_id)
    await event_service.event_broker.publish("job", {"job_id": job_id, "state": "running"})

    try:
        result = await asyncio.to_thread(runner)
        if isinstance(result, dict):
            result_json = json.dumps(result)
        elif result is None:
            result_json = None
        else:
            result_json = json.dumps({"value": result})
        job_repository.mark_succeeded(job_id, result_json=result_json)
        await event_service.event_broker.publish("job", {"job_id": job_id, "state": "succeeded"})
    except Exception as exc:  # noqa: BLE001
        job_repository.mark_failed(job_id, error_message=str(exc))
        await event_service.event_broker.publish(
            "job",
            {"job_id": job_id, "state": "failed", "error": str(exc)},
        )


def _to_job(row: dict[str, object]) -> dict[str, object]:
    payload = _decode_json(row.get("payload_json"))
    result = _decode_json(row.get("result_json"))
    return {
        "id": row["id"],
        "type": row["job_type"],
        "state": row["state"],
        "payload": payload,
        "result": result,
        "error": row.get("error_message"),
        "created_at": row["created_at"],
        "started_at": row.get("started_at"),
        "finished_at": row.get("finished_at"),
        "updated_at": row["updated_at"],
    }


def _decode_json(value: object) -> dict[str, object] | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        decoded = json.loads(value)
    except json.JSONDecodeError:
        return {"raw": value}
    if isinstance(decoded, dict):
        return decoded
    return {"value": decoded}
