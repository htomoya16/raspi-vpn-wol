from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.target import (
    Target,
    TargetDeleteResponse,
    TargetDeleted,
    TargetItemResponse,
    TargetsListResponse,
    TargetUpsertRequest,
)
from app.services import target_service

router = APIRouter()


@router.get("/targets", response_model=TargetsListResponse)
def get_targets() -> TargetsListResponse:
    items = [Target.model_validate(item) for item in target_service.list_targets()]
    return TargetsListResponse(items=items)


@router.post("/targets", response_model=TargetItemResponse)
def upsert_target(payload: TargetUpsertRequest) -> TargetItemResponse:
    try:
        item = Target.model_validate(
            target_service.save_target(
                target_id=payload.id,
                name=payload.name,
                mac_address=payload.mac_address,
                ip_address=payload.ip_address,
                broadcast_ip=payload.broadcast_ip,
                send_interface=payload.send_interface,
                wol_port=payload.wol_port,
                status_method=payload.status_method,
                status_port=payload.status_port,
            )
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return TargetItemResponse(item=item)


@router.delete("/targets/{target_id}", response_model=TargetDeleteResponse)
def delete_target(target_id: str) -> TargetDeleteResponse:
    try:
        deleted = target_service.delete_target(target_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return TargetDeleteResponse(deleted=TargetDeleted.model_validate(deleted))
