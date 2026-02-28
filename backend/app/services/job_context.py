from __future__ import annotations

from contextvars import ContextVar, Token

_current_job_id: ContextVar[str | None] = ContextVar("current_job_id", default=None)
_current_job_type: ContextVar[str | None] = ContextVar("current_job_type", default=None)
_current_job_source: ContextVar[str | None] = ContextVar("current_job_source", default=None)


def set_current_job_id(job_id: str) -> Token[str | None]:
    return _current_job_id.set(job_id)


def set_current_job_metadata(
    *,
    job_type: str | None,
    job_source: str | None,
) -> tuple[Token[str | None], Token[str | None]]:
    type_token = _current_job_type.set(job_type)
    source_token = _current_job_source.set(job_source)
    return type_token, source_token


def reset_current_job_id(token: Token[str | None]) -> None:
    _current_job_id.reset(token)


def reset_current_job_metadata(tokens: tuple[Token[str | None], Token[str | None]]) -> None:
    type_token, source_token = tokens
    _current_job_type.reset(type_token)
    _current_job_source.reset(source_token)


def get_current_job_id() -> str | None:
    return _current_job_id.get()


def get_current_job_type() -> str | None:
    return _current_job_type.get()


def get_current_job_source() -> str | None:
    return _current_job_source.get()


def is_current_periodic_status_job() -> bool:
    return get_current_job_type() == "status_refresh_all" and get_current_job_source() == "scheduler"
