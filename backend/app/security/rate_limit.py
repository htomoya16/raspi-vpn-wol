from __future__ import annotations

import math
import time
from collections import deque
from dataclasses import dataclass
from threading import Lock
from typing import Any, Callable

from fastapi import Depends, HTTPException, Request, status

from app.security.bearer_guard import require_admin_token, require_bearer_token


@dataclass(frozen=True, slots=True)
class RateLimitRule:
    scope: str
    limit: int
    window_seconds: int


class InMemoryRateLimiter:
    def __init__(
        self,
        *,
        now_func: Callable[[], float] | None = None,
        max_keys: int = 2048,
    ) -> None:
        self._now_func = now_func or time.monotonic
        self._max_keys = max(64, max_keys)
        self._lock = Lock()
        self._events: dict[str, deque[float]] = {}

    def consume(self, key: str, rule: RateLimitRule) -> tuple[bool, int]:
        now = self._now_func()
        cutoff = now - float(rule.window_seconds)
        with self._lock:
            bucket = self._events.get(key)
            if bucket is None:
                bucket = deque()
                self._events[key] = bucket

            while bucket and bucket[0] <= cutoff:
                bucket.popleft()

            if len(bucket) >= rule.limit:
                wait_seconds = max(1, math.ceil(rule.window_seconds - (now - bucket[0])))
                return False, int(wait_seconds)

            bucket.append(now)
            self._compact_if_needed(cutoff)
            return True, 0

    def reset(self) -> None:
        with self._lock:
            self._events.clear()

    def _compact_if_needed(self, cutoff: float) -> None:
        if len(self._events) <= self._max_keys:
            return
        stale_keys = [key for key, bucket in self._events.items() if not bucket or bucket[-1] <= cutoff]
        for key in stale_keys:
            self._events.pop(key, None)


RATE_LIMIT_WOL_SEND = RateLimitRule(scope="wol_send", limit=3, window_seconds=60)
RATE_LIMIT_REFRESH_PC = RateLimitRule(scope="status_refresh_pc", limit=6, window_seconds=60)
RATE_LIMIT_REFRESH_ALL = RateLimitRule(scope="status_refresh_all", limit=1, window_seconds=30)
RATE_LIMIT_ADMIN_WRITE = RateLimitRule(scope="admin_tokens_write", limit=10, window_seconds=600)

_rate_limiter = InMemoryRateLimiter()


def reset_rate_limiter_for_test() -> None:
    _rate_limiter.reset()


async def enforce_wol_send_rate_limit(
    request: Request,
    authenticated: dict[str, Any] | None = Depends(require_bearer_token),
) -> None:
    _enforce_rule(request, authenticated, RATE_LIMIT_WOL_SEND)


async def enforce_refresh_pc_rate_limit(
    request: Request,
    authenticated: dict[str, Any] | None = Depends(require_bearer_token),
) -> None:
    _enforce_rule(request, authenticated, RATE_LIMIT_REFRESH_PC)


async def enforce_refresh_all_rate_limit(
    request: Request,
    authenticated: dict[str, Any] | None = Depends(require_bearer_token),
) -> None:
    _enforce_rule(request, authenticated, RATE_LIMIT_REFRESH_ALL)


async def enforce_admin_write_rate_limit(
    request: Request,
    authenticated: dict[str, Any] | None = Depends(require_admin_token),
) -> None:
    _enforce_rule(request, authenticated, RATE_LIMIT_ADMIN_WRITE)


def _enforce_rule(
    request: Request,
    authenticated: dict[str, Any] | None,
    rule: RateLimitRule,
) -> None:
    subject = _build_subject_key(request, authenticated)
    cache_key = f"{rule.scope}:{subject}"
    allowed, retry_after = _rate_limiter.consume(cache_key, rule)
    if allowed:
        return
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="too many requests",
        headers={"Retry-After": str(retry_after)},
    )


def _build_subject_key(request: Request, authenticated: dict[str, Any] | None) -> str:
    token_id = _extract_token_id(authenticated)
    if token_id:
        return f"token:{token_id}"
    client_host = request.client.host if request.client is not None else "unknown"
    return f"ip:{client_host}"


def _extract_token_id(authenticated: dict[str, Any] | None) -> str:
    if authenticated is None:
        return ""
    token_id = authenticated.get("id")
    if token_id is None:
        return ""
    return str(token_id).strip()
