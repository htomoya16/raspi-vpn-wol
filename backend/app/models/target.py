from __future__ import annotations

from pydantic import BaseModel, Field


class Target(BaseModel):
    id: str = Field(
        ...,
        description="ターゲット ID（論理キー）。",
        json_schema_extra={"example": "main-pc"},
    )
    name: str = Field(
        ...,
        description="表示名。",
        json_schema_extra={"example": "Main Desktop"},
    )
    mac_address: str = Field(
        ...,
        description="WOL 送信先 MAC アドレス（正規化形式）。",
        json_schema_extra={"example": "AA:BB:CC:DD:EE:FF"},
    )
    ip_address: str | None = Field(
        default=None,
        description="状態確認で使う IPv4 アドレス。",
        json_schema_extra={"example": "192.168.1.10"},
    )
    broadcast_ip: str | None = Field(
        default=None,
        description="WOL 送信先 Broadcast IP。未指定時は IF から自動算出。",
        json_schema_extra={"example": "192.168.1.255"},
    )
    send_interface: str = Field(
        ...,
        description="WOL パケット送信に使うネットワークインターフェース。",
        json_schema_extra={"example": "eth0"},
    )
    wol_port: int = Field(
        ...,
        ge=1,
        le=65535,
        description="WOL UDP ポート。",
        json_schema_extra={"example": 9},
    )
    status_method: str = Field(
        ...,
        description="状態確認方式（tcp または ping）。",
        json_schema_extra={"example": "tcp"},
    )
    status_port: int = Field(
        ...,
        ge=1,
        le=65535,
        description="status_method=tcp のときに確認するポート。",
        json_schema_extra={"example": 445},
    )
    created_at: str | None = Field(
        default=None,
        description="作成時刻（ISO 8601 文字列）。",
        json_schema_extra={"example": "2026-02-20T12:00:00Z"},
    )
    updated_at: str | None = Field(
        default=None,
        description="更新時刻（ISO 8601 文字列）。",
        json_schema_extra={"example": "2026-02-20T12:10:00Z"},
    )


class TargetUpsertRequest(BaseModel):
    id: str = Field(
        ...,
        min_length=1,
        description="ターゲット ID（論理キー）。",
        json_schema_extra={"example": "main-pc"},
    )
    name: str = Field(
        ...,
        min_length=1,
        description="表示名。",
        json_schema_extra={"example": "Main Desktop"},
    )
    mac_address: str = Field(
        ...,
        min_length=2,
        description="WOL 送信先 MAC アドレス。",
        json_schema_extra={"example": "aa-bb-cc-dd-ee-ff"},
    )
    ip_address: str | None = Field(
        default=None,
        description="状態確認で使う IPv4 アドレス。",
        json_schema_extra={"example": "192.168.1.10"},
    )
    broadcast_ip: str | None = Field(
        default=None,
        description="WOL 送信先 Broadcast IP。未指定時は IF から自動算出。",
        json_schema_extra={"example": "192.168.1.255"},
    )
    send_interface: str | None = Field(
        default="eth0",
        min_length=1,
        description="WOL パケット送信に使うネットワークインターフェース。",
        json_schema_extra={"example": "eth0"},
    )
    wol_port: int = Field(
        default=9,
        ge=1,
        le=65535,
        description="WOL UDP ポート。",
        json_schema_extra={"example": 9},
    )
    status_method: str | None = Field(
        default="tcp",
        min_length=1,
        description="状態確認方式（tcp または ping）。",
        json_schema_extra={"example": "tcp"},
    )
    status_port: int | None = Field(
        default=445,
        ge=1,
        le=65535,
        description="status_method=tcp のときに確認するポート。",
        json_schema_extra={"example": 445},
    )


class TargetsListResponse(BaseModel):
    items: list[Target] = Field(
        ...,
        description="登録済みターゲット一覧。",
    )


class TargetItemResponse(BaseModel):
    item: Target = Field(
        ...,
        description="作成または更新されたターゲット。",
    )


class TargetDeleted(BaseModel):
    id: str = Field(
        ...,
        description="削除されたターゲット ID。",
        json_schema_extra={"example": "main-pc"},
    )


class TargetDeleteResponse(BaseModel):
    deleted: TargetDeleted = Field(
        ...,
        description="削除結果。",
    )
