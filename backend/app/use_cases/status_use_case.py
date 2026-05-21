from __future__ import annotations

import asyncio

from app.services import event_service, job_service, pc_service


async def refresh_pc_status(pc_id: str) -> dict[str, object]:
    pc = await asyncio.to_thread(pc_service.refresh_pc_status, pc_id)
    await event_service.event_broker.publish(
        "pc_status",
        {
            "pc_id": pc_id,
            "status": pc["status"],
            "updated_at": pc["updated_at"],
            "last_seen_at": pc["last_seen_at"],
        },
    )
    return pc


async def request_refresh_all_statuses() -> dict[str, object]:
    job, created = job_service.create_or_get_active_job("status_refresh_all", payload=None)
    if created:
        asyncio.create_task(job_service.run_job(str(job["id"]), pc_service.refresh_all_statuses))
        await event_service.event_broker.publish("job", {"job_id": job["id"], "state": "queued"})
    return job

