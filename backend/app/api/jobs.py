from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response

from app.models.jobs import JobResponse
from app.services import job_service

router = APIRouter()


@router.get(
    "/jobs/{job_id}",
    response_model=JobResponse,
    summary="ジョブ状態取得",
    responses={
        400: {"description": "入力値不正"},
        404: {"description": "対象が存在しない"},
    },
)
def get_job(response: Response, job_id: str) -> JobResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        job = job_service.get_job(job_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return JobResponse(job=job)
