from __future__ import annotations

import copy
import threading
from dataclasses import dataclass
from time import monotonic
from typing import Any


@dataclass
class _CacheItem:
    value: Any
    expires_at: float


class MemoryCache:
    def __init__(
        self,
        *,
        max_items: int = 1000,
        sweep_interval_seconds: int = 60,
    ) -> None:
        self._items: dict[str, _CacheItem] = {}
        self._lock = threading.RLock()
        self._max_items = max_items if max_items > 0 else 1000
        self._sweep_interval_seconds = sweep_interval_seconds if sweep_interval_seconds > 0 else 60
        self._next_sweep_at = 0.0

    def get(self, key: str) -> Any | None:
        with self._lock:
            current = monotonic()
            self._maybe_sweep_expired(current)
            item = self._items.get(key)
            if item is None:
                return None
            if item.expires_at <= current:
                self._items.pop(key, None)
                return None
            return copy.deepcopy(item.value)

    def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        if ttl_seconds <= 0:
            self.invalidate(key)
            return
        with self._lock:
            current = monotonic()
            self._maybe_sweep_expired(current)
            if key in self._items:
                self._items.pop(key, None)
            self._items[key] = _CacheItem(
                value=copy.deepcopy(value),
                expires_at=current + ttl_seconds,
            )
            self._trim_over_capacity()

    def invalidate(self, key: str) -> bool:
        with self._lock:
            return self._items.pop(key, None) is not None

    def invalidate_prefix(self, prefix: str) -> int:
        with self._lock:
            matched = [key for key in self._items if key.startswith(prefix)]
            for key in matched:
                self._items.pop(key, None)
            return len(matched)

    def clear(self) -> None:
        with self._lock:
            self._items.clear()
            self._next_sweep_at = 0.0

    def _maybe_sweep_expired(self, current: float) -> None:
        if current < self._next_sweep_at:
            return
        self._next_sweep_at = current + float(self._sweep_interval_seconds)
        expired_keys = [key for key, item in self._items.items() if item.expires_at <= current]
        for key in expired_keys:
            self._items.pop(key, None)

    def _trim_over_capacity(self) -> None:
        while len(self._items) > self._max_items:
            oldest_key = next(iter(self._items))
            self._items.pop(oldest_key, None)


cache = MemoryCache()
