from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Response, status

from app.models.jobs import JobAccepted
from app.models.pcs import PcCreate, PcListResponse, PcResponse, PcStatus, PcUpdate
from app.models.uptime import PcUptimeSummaryResponse, PcWeeklyTimelineResponse, UptimeBucket
from app.models.wol import WolRequest
from app.security.rate_limit import (
    enforce_refresh_all_rate_limit,
    enforce_refresh_pc_rate_limit,
    enforce_wol_send_rate_limit,
)
from app.services import pc_service
from app.services.pc_service import PcConflictError
from app.use_cases import status_use_case
from app.use_cases import wol_use_case

router = APIRouter()


@router.get(
    "/pcs",
    response_model=PcListResponse,
    summary="PC一覧取得",
)
def list_pcs(
    response: Response,
    q: str | None = Query(default=None),
    status_filter: PcStatus | None = Query(default=None, alias="status"),
    tag: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    cursor: str | None = Query(default=None),
) -> PcListResponse:
    response.headers["Cache-Control"] = "private, max-age=10, stale-while-revalidate=20"
    items, next_cursor = pc_service.list_pcs(
        q=q,
        status=status_filter,
        tag=tag,
        limit=limit,
        cursor=cursor,
    )
    return PcListResponse(items=items, next_cursor=next_cursor)


@router.post(
    "/pcs",
    response_model=PcResponse,
    status_code=status.HTTP_201_CREATED,
    summary="PC登録",
    responses={
        400: {"description": "入力値不正"},
        409: {"description": "重複ID/MAC"},
        422: {"description": "リクエスト形式エラー"},
    },
)
def create_pc(payload: PcCreate) -> PcResponse:
    try:
        pc = pc_service.create_pc(payload)
    except PcConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return PcResponse(pc=pc)


@router.get(
    "/pcs/{pc_id}",
    response_model=PcResponse,
    summary="PC詳細取得",
    responses={
        400: {"description": "入力値不正"},
        404: {"description": "対象が存在しない"},
    },
)
def get_pc(pc_id: str) -> PcResponse:
    try:
        pc = pc_service.get_pc(pc_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return PcResponse(pc=pc)


@router.patch(
    "/pcs/{pc_id}",
    response_model=PcResponse,
    summary="PC部分更新",
    responses={
        400: {"description": "入力値不正"},
        409: {"description": "重複MAC"},
        404: {"description": "対象が存在しない"},
        422: {"description": "リクエスト形式エラー"},
    },
)
def update_pc(pc_id: str, payload: PcUpdate) -> PcResponse:
    try:
        pc = pc_service.update_pc(pc_id, payload)
    except PcConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return PcResponse(pc=pc)


@router.delete(
    "/pcs/{pc_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="PC削除",
    responses={
        400: {"description": "入力値不正"},
        404: {"description": "対象が存在しない"},
    },
)
def delete_pc(pc_id: str) -> None:
    try:
        pc_service.delete_pc(pc_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post(
    "/pcs/{pc_id}/wol",
    response_model=JobAccepted,
    status_code=status.HTTP_202_ACCEPTED,
    summary="WOL送信（非同期）",
    dependencies=[Depends(enforce_wol_send_rate_limit)],
    responses={
        400: {"description": "入力値不正"},
        404: {"description": "対象が存在しない"},
        429: {"description": "レート制限超過"},
        422: {"description": "リクエスト形式エラー"},
    },
)
async def send_wol(
    pc_id: str,
    payload: WolRequest | None = Body(default=None),
) -> JobAccepted:
    try:
        job = await wol_use_case.request_wol(pc_id, payload)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return JobAccepted(job_id=job["id"], state=job["state"])


@router.post(
    "/pcs/{pc_id}/status/refresh",
    response_model=PcResponse,
    summary="単体ステータス更新",
    dependencies=[Depends(enforce_refresh_pc_rate_limit)],
    responses={404: {"description": "対象が存在しない"}, 429: {"description": "レート制限超過"}},
)
async def refresh_pc_status(pc_id: str) -> PcResponse:
    try:
        pc = await status_use_case.refresh_pc_status(pc_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return PcResponse(pc=pc)


@router.post(
    "/pcs/status/refresh",
    response_model=JobAccepted,
    status_code=status.HTTP_202_ACCEPTED,
    summary="全PCステータス更新（非同期）",
    dependencies=[Depends(enforce_refresh_all_rate_limit)],
    responses={429: {"description": "レート制限超過"}},
)
async def refresh_all_statuses() -> JobAccepted:
    job = await status_use_case.request_refresh_all_statuses()
    return JobAccepted(job_id=job["id"], state=job["state"])


@router.get(
    "/pcs/{pc_id}/uptime/summary",
    response_model=PcUptimeSummaryResponse,
    summary="オンライン集計取得",
    responses={
        400: {"description": "入力値不正"},
        404: {"description": "対象が存在しない"},
        422: {"description": "リクエスト形式エラー"},
    },
)
def get_uptime_summary(
    http_response: Response,
    pc_id: str,
    from_date: str | None = Query(default=None, alias="from"),
    to_date: str | None = Query(default=None, alias="to"),
    bucket: UptimeBucket = Query(default="day"),
    tz: str | None = Query(default="Asia/Tokyo"),
) -> PcUptimeSummaryResponse:
    http_response.headers["Cache-Control"] = "private, max-age=30, stale-while-revalidate=90"
    try:
        data = pc_service.get_uptime_summary(
            pc_id=pc_id,
            from_date=from_date,
            to_date=to_date,
            bucket=bucket,
            tz=tz,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return PcUptimeSummaryResponse.model_validate(data)


@router.get(
    "/pcs/{pc_id}/uptime/weekly",
    response_model=PcWeeklyTimelineResponse,
    summary="週タイムライン取得",
    responses={
        400: {"description": "入力値不正"},
        404: {"description": "対象が存在しない"},
        422: {"description": "リクエスト形式エラー"},
    },
)
def get_weekly_timeline(
    http_response: Response,
    pc_id: str,
    week_start: str | None = Query(default=None),
    tz: str | None = Query(default="Asia/Tokyo"),
) -> PcWeeklyTimelineResponse:
    http_response.headers["Cache-Control"] = "private, max-age=30, stale-while-revalidate=90"
    try:
        data = pc_service.get_weekly_timeline(
            pc_id=pc_id,
            week_start=week_start,
            tz=tz,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return PcWeeklyTimelineResponse.model_validate(data)
