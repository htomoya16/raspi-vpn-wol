from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncGenerator


class EventBroker:
    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[str]] = set()
        self._lock = asyncio.Lock()

    async def publish(self, event: str, data: dict[str, object]) -> None:
        payload = f"event: {event}\ndata: {json.dumps(data, ensure_ascii=True)}\n\n"
        async with self._lock:
            subscribers = list(self._subscribers)
        for queue in subscribers:
            try:
                queue.put_nowait(payload)
            except asyncio.QueueFull:
                # Drop event when a slow subscriber lags behind.
                continue

    async def stream(self) -> AsyncGenerator[str, None]:
        queue: asyncio.Queue[str] = asyncio.Queue(maxsize=100)
        async with self._lock:
            self._subscribers.add(queue)
        try:
            while True:
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=15)
                    yield message
                except TimeoutError:
                    yield ": keep-alive\n\n"
        finally:
            async with self._lock:
                self._subscribers.discard(queue)


event_broker = EventBroker()
