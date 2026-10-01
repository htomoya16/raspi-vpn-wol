from __future__ import annotations

import asyncio

from app.services import event_service, job_service, shutdown_service


async def request_pc_shutdown(pc_id: str) -> dict[str, object]:
    """対象PCの停止ジョブを受け付け、非同期実行を開始する。

    Args:
        pc_id: 停止対象の登録済みPC ID。

    Returns:
        作成したジョブ、または同じPCですでに実行中のジョブ。

    Raises:
        LookupError: 対象PCが存在しない場合。
        ShutdownUnavailableError: SSH未設定、またはPCがオンラインでない場合。
    """
    settings = shutdown_service.get_ready_shutdown_connection(pc_id)
    job, created = job_service.create_or_get_active_job(
        "shutdown", payload={"pc_id": pc_id}, pc_id=pc_id,
    )
    if created:
        # 同じPCへの再要求では既存ジョブを返し、停止命令の二重送信を避ける。
        asyncio.create_task(job_service.run_job(
            str(job["id"]), lambda: shutdown_service.shutdown_pc_and_check_status(pc_id, settings),
        ))
        await event_service.event_broker.publish("job", {"job_id": job["id"], "state": "queued"})
    return job
