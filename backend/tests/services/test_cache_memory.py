from __future__ import annotations

from app.cache import memory_cache


def test_memory_cache_get_set_and_copy() -> None:
    cache = memory_cache.MemoryCache()
    payload = {"items": [1, 2, 3]}

    cache.set("k", payload, ttl_seconds=30)
    value = cache.get("k")
    assert value == payload

    assert isinstance(value, dict)
    value["items"].append(4)
    assert cache.get("k") == payload


def test_memory_cache_expires_by_ttl(monkeypatch) -> None:
    cache = memory_cache.MemoryCache()
    now = 100.0
    monkeypatch.setattr(memory_cache, "monotonic", lambda: now)

    cache.set("k", {"ok": True}, ttl_seconds=10)
    assert cache.get("k") == {"ok": True}

    now = 111.0
    assert cache.get("k") is None


def test_memory_cache_invalidate_prefix() -> None:
    cache = memory_cache.MemoryCache()
    cache.set("pcs:list:a", {"v": 1}, ttl_seconds=30)
    cache.set("pcs:list:b", {"v": 2}, ttl_seconds=30)
    cache.set("uptime:weekly:a", {"v": 3}, ttl_seconds=30)

    removed = cache.invalidate_prefix("pcs:list:")
    assert removed == 2
    assert cache.get("pcs:list:a") is None
    assert cache.get("pcs:list:b") is None
    assert cache.get("uptime:weekly:a") == {"v": 3}


def test_memory_cache_evicts_oldest_when_over_capacity() -> None:
    cache = memory_cache.MemoryCache(max_items=2, sweep_interval_seconds=60)
    cache.set("a", {"v": 1}, ttl_seconds=30)
    cache.set("b", {"v": 2}, ttl_seconds=30)
    cache.set("c", {"v": 3}, ttl_seconds=30)

    assert cache.get("a") is None
    assert cache.get("b") == {"v": 2}
    assert cache.get("c") == {"v": 3}


def test_memory_cache_sweeps_expired_entries_periodically(monkeypatch) -> None:
    now = 10.0
    monkeypatch.setattr(memory_cache, "monotonic", lambda: now)
    cache = memory_cache.MemoryCache(max_items=10, sweep_interval_seconds=5)
    cache.set("expired", {"v": 1}, ttl_seconds=1)
    assert "expired" in cache._items

    now = 20.0
    cache.set("fresh", {"v": 2}, ttl_seconds=30)
    assert "expired" not in cache._items
    assert cache.get("fresh") == {"v": 2}
