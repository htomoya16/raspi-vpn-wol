from __future__ import annotations

from contextvars import ContextVar, Token
from typing import TypedDict


class ApiActor(TypedDict):
    token_id: str
    token_name: str
    token_role: str


_current_api_actor: ContextVar[ApiActor | None] = ContextVar("current_api_actor", default=None)


def set_current_api_actor(actor: ApiActor | None) -> Token[ApiActor | None]:
    if actor is None:
        return _current_api_actor.set(None)
    return _current_api_actor.set(
        {
            "token_id": actor["token_id"],
            "token_name": actor["token_name"],
            "token_role": actor["token_role"],
        }
    )


def reset_current_api_actor(token: Token[ApiActor | None]) -> None:
    _current_api_actor.reset(token)


def get_current_api_actor() -> ApiActor | None:
    return _current_api_actor.get()
