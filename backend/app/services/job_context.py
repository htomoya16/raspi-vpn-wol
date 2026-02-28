from __future__ import annotations

from contextvars import ContextVar, Token

_current_job_id: ContextVar[str | None] = ContextVar("current_job_id", default=None)


def set_current_job_id(job_id: str) -> Token[str | None]:
    return _current_job_id.set(job_id)


def reset_current_job_id(token: Token[str | None]) -> None:
    _current_job_id.reset(token)


def get_current_job_id() -> str | None:
    return _current_job_id.get()

