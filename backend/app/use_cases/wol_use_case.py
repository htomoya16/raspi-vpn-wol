from __future__ import annotations

import asyncio

from app.models.wol import WolRequest
from app.services import event_service, job_service, pc_service


async def request_wol(pc_id: str, payload: WolRequest | None) -> dict[str, object]:
    repeat = payload.repeat if payload is not None else 1
    broadcast = payload.broadcast if payload is not None else None
    port = payload.port if payload is not None else None

    job_payload: dict[str, object] = {"pc_id": pc_id, "repeat": repeat}
    if broadcast is not None:
        job_payload["broadcast"] = broadcast
    if port is not None:
        job_payload["port"] = port

    pc_service.get_pc(pc_id)

    job = job_service.create_job("wol", payload=job_payload)
    asyncio.create_task(
        job_service.run_job(
            str(job["id"]),
            lambda: pc_service.send_wol(pc_id, repeat=repeat, broadcast=broadcast, port=port),
        )
    )
    await event_service.event_broker.publish("job", {"job_id": job["id"], "state": "queued"})
    return job

