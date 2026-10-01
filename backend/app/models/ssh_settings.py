from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class PcSshSettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    username: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_][A-Za-z0-9_.-]*$")
    port: int = Field(default=22, ge=1, le=65535, strict=True)
    enabled: bool = False


class HostKeyConfirmation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    host_key: str = Field(min_length=1, max_length=256)
    fingerprint: str = Field(min_length=1, max_length=128)
    ip: str = Field(min_length=1, max_length=15)
    revision: int = Field(ge=1)


class HostKeyCandidate(BaseModel):
    host_key: str
    fingerprint: str
    ip: str
    revision: int


class PcSshSettingsResponse(BaseModel):
    pc_id: str
    ip: str
    username: str = ""
    port: int = 22
    enabled: bool = False
    public_key: str | None = None
    host_fingerprint: str | None = None
    verified: bool = False
    verified_at: str | None = None
    setup_script: str | None = None
    fingerprint_command: str = 'ssh-keygen.exe -lf "$env:ProgramData\\ssh\\ssh_host_ed25519_key.pub"'
