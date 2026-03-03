from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.models.api_tokens import (
    ApiTokenCreateRequest,
    ApiTokenCreateResponse,
    ApiTokenDeleteResponse,
    ApiTokenListResponse,
    ApiTokenRevokeResponse,
)
from app.security.rate_limit import enforce_admin_write_rate_limit
from app.services import api_token_service

router = APIRouter()


@router.get(
    "/admin/tokens",
    response_model=ApiTokenListResponse,
    summary="APIトークン一覧取得",
    responses={401: {"description": "認証エラー"}, 403: {"description": "認可エラー"}},
)
def list_api_tokens() -> ApiTokenListResponse:
    return ApiTokenListResponse(items=api_token_service.list_tokens())


@router.post(
    "/admin/tokens",
    response_model=ApiTokenCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="APIトークン発行",
    dependencies=[Depends(enforce_admin_write_rate_limit)],
    responses={
        400: {"description": "入力値不正"},
        401: {"description": "認証エラー"},
        403: {"description": "認可エラー"},
        429: {"description": "レート制限超過"},
        422: {"description": "リクエスト形式エラー"},
    },
)
def create_api_token(payload: ApiTokenCreateRequest) -> ApiTokenCreateResponse:
    try:
        result = api_token_service.create_token(name=payload.name, expires_at=payload.expires_at, role=payload.role)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ApiTokenCreateResponse.model_validate(result)


@router.post(
    "/admin/tokens/{token_id}/revoke",
    response_model=ApiTokenRevokeResponse,
    summary="APIトークン失効",
    dependencies=[Depends(enforce_admin_write_rate_limit)],
    responses={
        400: {"description": "入力値不正"},
        401: {"description": "認証エラー"},
        403: {"description": "認可エラー"},
        404: {"description": "対象が存在しない"},
        429: {"description": "レート制限超過"},
    },
)
def revoke_api_token(token_id: str) -> ApiTokenRevokeResponse:
    try:
        token = api_token_service.revoke_token(token_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ApiTokenRevokeResponse(token=token)


@router.delete(
    "/admin/tokens/{token_id}",
    response_model=ApiTokenDeleteResponse,
    summary="APIトークン削除",
    dependencies=[Depends(enforce_admin_write_rate_limit)],
    responses={
        400: {"description": "入力値不正（未失効トークン含む）"},
        401: {"description": "認証エラー"},
        403: {"description": "認可エラー"},
        404: {"description": "対象が存在しない"},
        429: {"description": "レート制限超過"},
    },
)
def delete_api_token(token_id: str) -> ApiTokenDeleteResponse:
    try:
        deleted = api_token_service.delete_token(token_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ApiTokenDeleteResponse.model_validate(deleted)
