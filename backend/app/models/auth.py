from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

ApiActorRole = Literal["admin", "device"]


class ApiActorMeResponse(BaseModel):
    token_id: str = Field(..., description="現在利用中トークンID。")
    token_name: str = Field(..., description="現在利用中トークン名。")
    token_role: ApiActorRole = Field(..., description="現在利用中トークンロール。")
