from __future__ import annotations

import asyncio
import logging

from app.services import event_service, job_service, pc_service

STATUS_MONITOR_INTERVAL_SECONDS = 60
logger = logging.getLogger(__name__)


async def enqueue_status_refresh_all_job() -> str:
    job, created = job_service.create_or_get_active_job(
        "status_refresh_all",
        payload={"source": "scheduler"},
    )
    if created:
        asyncio.create_task(job_service.run_job(job["id"], pc_service.refresh_all_statuses))
        await event_service.event_broker.publish("job", {"job_id": job["id"], "state": "queued"})
    return str(job["id"])


async def run_periodic_status_monitor() -> None:
    while True:
        await asyncio.sleep(STATUS_MONITOR_INTERVAL_SECONDS)
        try:
            await enqueue_status_refresh_all_job()
        except Exception:  # noqa: BLE001
            logger.exception("failed to enqueue periodic status refresh job")
