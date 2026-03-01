from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

ApiTokenRole = Literal["admin", "device"]


class ApiToken(BaseModel):
    id: str = Field(..., description="トークンID。")
    name: str = Field(..., description="端末識別名。")
    role: ApiTokenRole = Field(..., description="トークン権限。")
    token_prefix: str = Field(..., description="表示用トークンprefix。")
    created_at: str = Field(..., description="作成時刻。")
    expires_at: str | None = Field(default=None, description="有効期限。")
    last_used_at: str | None = Field(default=None, description="最終利用時刻。")
    revoked_at: str | None = Field(default=None, description="失効時刻。")


class ApiTokenListResponse(BaseModel):
    items: list[ApiToken] = Field(..., description="APIトークン一覧。")


class ApiTokenCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, description="端末識別名。")
    role: ApiTokenRole | None = Field(default=None, description="権限。未指定時は通常 `device`（初回ブートストラップ時は `admin`）。")
    expires_at: str | None = Field(default=None, description="有効期限（ISO8601, timezone付き, 任意）。")


class ApiTokenCreateResponse(BaseModel):
    token: ApiToken = Field(..., description="作成されたトークン情報。")
    plain_token: str = Field(..., description="平文トークン（作成時のみ返却）。")


class ApiTokenRevokeResponse(BaseModel):
    token: ApiToken = Field(..., description="失効後のトークン情報。")


class ApiTokenDeleteResponse(BaseModel):
    deleted_token_id: str = Field(..., description="削除したトークンID。")
    deleted: bool = Field(..., description="削除結果。")
