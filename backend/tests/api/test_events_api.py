from __future__ import annotations

from collections.abc import AsyncGenerator

from fastapi.testclient import TestClient


def test_events_endpoint_streams_sse_content(client: TestClient, monkeypatch) -> None:
    import app.api.events as events_api

    async def _fake_stream() -> AsyncGenerator[str, None]:
        yield "event: ping\ndata: {\"ok\": true}\n\n"

    monkeypatch.setattr(events_api.event_service.event_broker, "stream", _fake_stream)

    response = client.get("/api/events")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert "event: ping" in response.text
