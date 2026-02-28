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
    def __init__(self) -> None:
        self._items: dict[str, _CacheItem] = {}
        self._lock = threading.RLock()

    def get(self, key: str) -> Any | None:
        with self._lock:
            item = self._items.get(key)
            if item is None:
                return None
            if item.expires_at <= monotonic():
                self._items.pop(key, None)
                return None
            return copy.deepcopy(item.value)

    def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        if ttl_seconds <= 0:
            self.invalidate(key)
            return
        with self._lock:
            self._items[key] = _CacheItem(
                value=copy.deepcopy(value),
                expires_at=monotonic() + ttl_seconds,
            )

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


cache = MemoryCache()
