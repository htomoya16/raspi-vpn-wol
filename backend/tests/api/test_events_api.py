from __future__ import annotations

from collections.abc import AsyncGenerator

from fastapi.testclient import TestClient

from app.services import api_token_service


def test_events_endpoint_streams_sse_content(client: TestClient, monkeypatch) -> None:
    import app.api.events as events_api

    async def _fake_stream() -> AsyncGenerator[str, None]:
        yield "event: ping\ndata: {\"ok\": true}\n\n"

    monkeypatch.setattr(events_api.event_service.event_broker, "stream", _fake_stream)

    response = client.get("/api/events")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert "event: ping" in response.text


def test_events_endpoint_accepts_query_token(client_without_auth_header: TestClient, monkeypatch) -> None:
    import app.api.events as events_api

    async def _fake_stream() -> AsyncGenerator[str, None]:
        yield "event: ping\ndata: {\"ok\": true}\n\n"

    monkeypatch.setattr(events_api.event_service.event_broker, "stream", _fake_stream)
    issued = api_token_service.create_token(name="pytest-sse-token", expires_at=None)

    response = client_without_auth_header.get(f"/api/events?token={issued['plain_token']}")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert "event: ping" in response.text
