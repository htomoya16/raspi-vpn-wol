from __future__ import annotations

from app.models.api_tokens import ApiTokenCreateRequest
from app.services import api_token_service


def list_api_tokens() -> list[dict[str, object]]:
    return api_token_service.list_tokens()


def create_api_token(payload: ApiTokenCreateRequest) -> dict[str, object]:
    return api_token_service.create_token(
        name=payload.name,
        expires_at=payload.expires_at,
        role=payload.role,
    )


def revoke_api_token(token_id: str) -> dict[str, object]:
    return api_token_service.revoke_token(token_id)


def delete_api_token(token_id: str) -> dict[str, object]:
    return api_token_service.delete_token(token_id)

