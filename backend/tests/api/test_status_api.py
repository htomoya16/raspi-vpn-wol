from __future__ import annotations

from fastapi.testclient import TestClient


def _create_pc(
    client: TestClient,
    *,
    id: str | None = None,
    name: str = "Main PC",
    mac: str = "AA:BB:CC:DD:EE:01",
    ip: str | None = None,
) -> dict[str, object]:
    payload: dict[str, object] = {"name": name, "mac": mac}
    if id is not None:
        payload["id"] = id
    if ip is not None:
        payload["ip"] = ip
    response = client.post("/api/pcs", json=payload)
    assert response.status_code == 201, response.text
    return response.json()["pc"]


def test_status_refresh_without_ip_returns_unknown(client: TestClient) -> None:
    _create_pc(client, id="pc-no-ip", name="No IP", mac="AA:BB:CC:DD:EE:51")

    response = client.post("/api/pcs/pc-no-ip/status/refresh")
    assert response.status_code == 200
    body = response.json()["pc"]
    assert body["status"] == "unknown"

    logs_response = client.get("/api/logs", params={"pc_id": "pc-no-ip", "action": "status", "ok": "false"})
    assert logs_response.status_code == 200
    assert len(logs_response.json()["items"]) >= 1


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
