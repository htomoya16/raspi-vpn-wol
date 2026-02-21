from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.jobs import JobResponse
from app.services import job_service

router = APIRouter()


@router.get(
    "/jobs/{job_id}",
    response_model=JobResponse,
    summary="ジョブ状態取得",
    responses={404: {"description": "対象が存在しない"}},
)
def get_job(job_id: str) -> JobResponse:
    try:
        job = job_service.get_job(job_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return JobResponse(job=job)
