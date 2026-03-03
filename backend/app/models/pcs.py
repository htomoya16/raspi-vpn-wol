from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

PcStatus = Literal["online", "offline", "unknown", "booting", "unreachable"]


class Pc(BaseModel):
    id: str = Field(
        ...,
        description="PC識別子。",
        json_schema_extra={"example": "pc-main"},
    )
    name: str = Field(
        ...,
        description="表示名。",
        json_schema_extra={"example": "Main PC"},
    )
    mac: str = Field(
        ...,
        description="MACアドレス。",
        json_schema_extra={"example": "AA:BB:CC:DD:EE:FF"},
    )
    ip: str = Field(
        ...,
        description="IPv4アドレス。",
        json_schema_extra={"example": "192.168.10.20"},
    )
    tags: list[str] = Field(
        default_factory=list,
        description="分類タグ。",
    )
    note: str | None = Field(
        default=None,
        description="メモ。",
    )
    status: PcStatus = Field(
        ...,
        description="PC状態。",
        json_schema_extra={"example": "unknown"},
    )
    last_seen_at: str | None = Field(
        default=None,
        description="最終到達時刻。",
        json_schema_extra={"example": "2026-02-21T12:34:56+09:00"},
    )
    created_at: str = Field(
        ...,
        description="作成時刻。",
    )
    updated_at: str = Field(
        ...,
        description="更新時刻。",
    )


class PcCreate(BaseModel):
    id: str | None = Field(
        default=None,
        min_length=1,
        description="PC識別子。未指定時はサーバで生成する。",
        json_schema_extra={"example": "pc-main"},
    )
    name: str = Field(
        ...,
        min_length=1,
        description="表示名。",
        json_schema_extra={"example": "Main PC"},
    )
    mac: str = Field(
        ...,
        min_length=2,
        description="MACアドレス。",
        json_schema_extra={"example": "AA:BB:CC:DD:EE:FF"},
    )
    ip: str = Field(
        ...,
        min_length=1,
        description="IPv4アドレス。",
        json_schema_extra={"example": "192.168.10.20"},
    )
    tags: list[str] = Field(
        default_factory=list,
        description="分類タグ。",
    )
    note: str | None = Field(
        default=None,
        description="メモ。",
    )


class PcUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    mac: str | None = Field(default=None, min_length=2)
    ip: str | None = Field(default=None, min_length=1)
    tags: list[str] | None = Field(default=None)
    note: str | None = Field(default=None)

    @model_validator(mode="after")
    def validate_ip_not_null_when_provided(self) -> "PcUpdate":
        if "ip" in self.model_fields_set and self.ip is None:
            raise ValueError("ip is required")
        return self


class PcListResponse(BaseModel):
    items: list[Pc] = Field(
        ...,
        description="PC一覧。",
    )
    next_cursor: str | None = Field(
        default=None,
        description="次ページカーソル。",
    )


class PcResponse(BaseModel):
    pc: Pc = Field(
        ...,
        description="PC詳細。",
    )
