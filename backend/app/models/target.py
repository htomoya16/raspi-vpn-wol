from __future__ import annotations

from pydantic import BaseModel, Field


class Target(BaseModel):
    id: str
    name: str
    mac_address: str
    ip_address: str | None = None
    broadcast_ip: str | None = None
    send_interface: str
    wol_port: int
    status_method: str
    status_port: int
    created_at: str | None = None
    updated_at: str | None = None


class TargetUpsertRequest(BaseModel):
    id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    mac_address: str = Field(..., min_length=2)
    ip_address: str | None = None
    broadcast_ip: str | None = None
    send_interface: str | None = Field(default="eth0", min_length=1)
    wol_port: int = Field(default=9, ge=1, le=65535)
    status_method: str | None = Field(default="tcp", min_length=1)
    status_port: int | None = Field(default=445, ge=1, le=65535)


class TargetsListResponse(BaseModel):
    items: list[Target]


class TargetItemResponse(BaseModel):
    item: Target


class TargetDeleted(BaseModel):
    id: str


class TargetDeleteResponse(BaseModel):
    deleted: TargetDeleted
