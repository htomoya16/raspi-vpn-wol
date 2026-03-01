from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.models.auth import ApiActorMeResponse
from app.security import get_current_api_actor

router = APIRouter()


@router.get(
    "/auth/me",
    response_model=ApiActorMeResponse,
    summary="現在利用中トークン情報",
    responses={401: {"description": "認証エラー"}},
)
def get_current_actor() -> ApiActorMeResponse:
    actor = get_current_api_actor()
    if actor is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid bearer token")
    return ApiActorMeResponse.model_validate(actor)
