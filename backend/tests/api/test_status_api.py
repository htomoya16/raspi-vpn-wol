from __future__ import annotations

from fastapi.testclient import TestClient


def test_create_pc_without_ip_returns_422(client: TestClient) -> None:
    response = client.post(
        "/api/pcs",
        json={"id": "pc-no-ip", "name": "No IP", "mac": "AA:BB:CC:DD:EE:51"},
    )
    assert response.status_code == 422


def test_status_refresh_http_error_mapping(client: TestClient, monkeypatch) -> None:
    import app.api.pcs as pcs_api

    missing_response = client.post("/api/pcs/not-found/status/refresh")
    assert missing_response.status_code == 404

    async def _raise_value_error(_: str) -> dict[str, object]:
        raise ValueError("forced error")

    monkeypatch.setattr(pcs_api.status_use_case, "refresh_pc_status", _raise_value_error)
    value_error_response = client.post("/api/pcs/pc-any/status/refresh")
    assert value_error_response.status_code == 400
    assert value_error_response.json()["detail"] == "forced error"


def test_status_refresh_endpoint_uses_use_case(client: TestClient, monkeypatch) -> None:
    import app.api.pcs as pcs_api

    async def _fake_refresh_pc_status(pc_id: str) -> dict[str, object]:
        assert pc_id == "pc-status"
        return {
            "id": "pc-status",
            "name": "Status PC",
            "mac": "AA:BB:CC:DD:EE:81",
            "ip": "192.168.10.81",
            "tags": [],
            "note": None,
            "status": "online",
            "last_seen_at": "2026-03-03T00:00:00+00:00",
            "created_at": "2026-03-03T00:00:00+00:00",
            "updated_at": "2026-03-03T00:00:00+00:00",
        }

    monkeypatch.setattr(pcs_api.status_use_case, "refresh_pc_status", _fake_refresh_pc_status)

    response = client.post("/api/pcs/pc-status/status/refresh")

    assert response.status_code == 200
    assert response.json()["pc"]["id"] == "pc-status"
    assert response.json()["pc"]["status"] == "online"


def test_status_refresh_all_endpoint_uses_use_case(client: TestClient, monkeypatch) -> None:
    import app.api.pcs as pcs_api

    async def _fake_request_refresh_all_statuses() -> dict[str, object]:
        return {"id": "job-status-test", "state": "queued"}

    monkeypatch.setattr(
        pcs_api.status_use_case,
        "request_refresh_all_statuses",
        _fake_request_refresh_all_statuses,
    )

    response = client.post("/api/pcs/status/refresh")

    assert response.status_code == 202
    assert response.json() == {"job_id": "job-status-test", "state": "queued"}
