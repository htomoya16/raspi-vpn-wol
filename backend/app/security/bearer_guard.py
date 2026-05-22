from __future__ import annotations

from typing import Any

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.security.actor_context import set_current_api_actor
from app.services import api_token_service

_bearer = HTTPBearer(auto_error=False)


async def require_bearer_token(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict[str, Any] | None:
    """ブートストラップ中を除き、有効なBearerトークンを要求する。

    Args:
        request: SSEのクエリトークン代替を扱うためのFastAPIリクエスト。
        credentials: 解析済みのHTTP Authorizationヘッダー資格情報。

    Returns:
        認証済みトークンメタデータ。有効トークンが0件の間はNone。

    Raises:
        HTTPException: 認証が必要で、トークンが不正な場合。
    """
    # Bootstrap mode: if no active tokens exist yet, skip auth temporarily.
    if not api_token_service.has_active_tokens():
        set_current_api_actor(None)
        return None

    bearer_token = _resolve_bearer_token(request, credentials)
    if not bearer_token:
        set_current_api_actor(None)
        raise _unauthorized()
    try:
        authenticated = api_token_service.authenticate_bearer_token(bearer_token)
    except api_token_service.AuthError as exc:
        set_current_api_actor(None)
        raise _unauthorized() from exc
    set_current_api_actor(
        {
            "token_id": str(authenticated["id"]),
            "token_name": str(authenticated["name"]),
            "token_role": str(authenticated["role"]),
        }
    )
    return authenticated


async def require_admin_token(
    authenticated: dict[str, Any] | None = Depends(require_bearer_token),
) -> dict[str, Any] | None:
    """管理系エンドポイントでadminトークンを要求する。

    Args:
        authenticated: Bearer認証で得たトークンメタデータ。

    Returns:
        adminトークンメタデータ。ブートストラップ中はNone。

    Raises:
        HTTPException: 認証済みトークンがadminではない場合。
    """
    # Bootstrap mode: no active tokens yet.
    if authenticated is None:
        return None
    if str(authenticated.get("role")) != "admin":
        raise _forbidden()
    return authenticated


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="invalid bearer token",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _forbidden() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="insufficient scope",
    )


def _resolve_bearer_token(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None,
) -> str:
    if credentials is not None and credentials.scheme.lower() == "bearer":
        return credentials.credentials.strip()

    # EventSource does not support custom Authorization headers.
    # Allow query token only for SSE endpoint.
    if request.url.path.rstrip("/") == "/api/events":
        return request.query_params.get("token", "").strip()

    return ""
