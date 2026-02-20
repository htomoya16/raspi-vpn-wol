from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.target import (
    TargetDeleteResponse,
    TargetItemResponse,
    TargetsListResponse,
    TargetUpsertRequest,
)
from app.services import target_service

router = APIRouter()


@router.get(
    "/targets",
    response_model=TargetsListResponse,
    summary="ターゲット一覧を取得する",
    description="登録済みターゲット設定を返す。",
)
def get_targets() -> TargetsListResponse:
    return TargetsListResponse(items=target_service.list_targets())


@router.post(
    "/targets",
    response_model=TargetItemResponse,
    summary="ターゲットを作成または更新する",
    description="id をキーに upsert し、WOL/状態確認の設定を保存する。",
    responses={
        400: {"description": "業務エラー（サービス層の検証エラー）"},
        422: {"description": "リクエスト形式エラー（必須不足、型不正、範囲外）"},
    },
)
def upsert_target(payload: TargetUpsertRequest) -> TargetItemResponse:
    try:
        item = target_service.save_target(
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
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return TargetItemResponse(item=item)


@router.delete(
    "/targets/{target_id}",
    response_model=TargetDeleteResponse,
    summary="ターゲットを削除する",
    description="指定した target_id の設定を削除する。",
    responses={
        400: {"description": "業務エラー（ID不正）"},
        404: {"description": "対象が存在しない"},
    },
)
def delete_target(target_id: str) -> TargetDeleteResponse:
    try:
        deleted = target_service.delete_target(target_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return TargetDeleteResponse(deleted=deleted)
