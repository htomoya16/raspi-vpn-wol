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

    def _raise_value_error(_: str) -> dict[str, object]:
        raise ValueError("forced error")

    monkeypatch.setattr(pcs_api.pc_service, "refresh_pc_status", _raise_value_error)
    value_error_response = client.post("/api/pcs/pc-any/status/refresh")
    assert value_error_response.status_code == 400
    assert value_error_response.json()["detail"] == "forced error"
