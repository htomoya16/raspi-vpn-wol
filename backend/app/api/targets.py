from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services import target_service

router = APIRouter()


class TargetUpsertRequest(BaseModel):
    id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    mac_address: str = Field(..., min_length=2)
    ip_address: str | None = None
    broadcast_ip: str | None = None
    send_interface: str | None = Field(default="eth0", min_length=1)
    wol_port: int = Field(default=9, ge=1, le=65535)


@router.get("/targets")
def get_targets() -> dict[str, Any]:
    items = target_service.list_targets()
    return {"items": items}


@router.post("/targets")
def upsert_target(payload: TargetUpsertRequest) -> dict[str, Any]:
    try:
        item = target_service.save_target(
            target_id=payload.id,
            name=payload.name,
            mac_address=payload.mac_address,
            ip_address=payload.ip_address,
            broadcast_ip=payload.broadcast_ip,
            send_interface=payload.send_interface,
            wol_port=payload.wol_port,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {"item": item}
