from __future__ import annotations

from fastapi.testclient import TestClient


def test_health_ok(client: TestClient) -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_targets_upsert_list_delete_and_missing_delete(client: TestClient) -> None:
    payload = {
        "id": "pc-main",
        "name": "Main PC",
        "mac_address": "aa-bb-cc-dd-ee-ff",
    }

    upsert_response = client.post("/api/targets", json=payload)
    assert upsert_response.status_code == 200
    upsert_item = upsert_response.json()["item"]
    assert upsert_item["id"] == "pc-main"
    assert upsert_item["mac_address"] == "AA:BB:CC:DD:EE:FF"
    assert upsert_item["send_interface"] == "eth0"
    assert upsert_item["status_method"] == "tcp"
    assert upsert_item["status_port"] == 445

    list_response = client.get("/api/targets")
    assert list_response.status_code == 200
    list_items = list_response.json()["items"]
    assert len(list_items) == 1
    assert list_items[0]["id"] == "pc-main"

    delete_response = client.delete("/api/targets/pc-main")
    assert delete_response.status_code == 200
    assert delete_response.json() == {"deleted": {"id": "pc-main"}}

    missing_delete_response = client.delete("/api/targets/pc-main")
    assert missing_delete_response.status_code == 404
    assert "target not found" in missing_delete_response.json()["detail"]


def test_status_returns_400_for_missing_target(client: TestClient) -> None:
    response = client.get("/api/status", params={"target": "unknown"})

    assert response.status_code == 400
    assert "target not found" in response.json()["detail"]


def test_wol_returns_400_for_missing_target(client: TestClient) -> None:
    response = client.post("/api/wol", json={"target": "unknown"})

    assert response.status_code == 400
    assert "target not found" in response.json()["detail"]


def test_logs_limit_validation_and_items(client: TestClient) -> None:
    create_response = client.post(
        "/api/targets",
        json={
            "id": "pc-log",
            "name": "Log PC",
            "mac_address": "11:22:33:44:55:66",
        },
    )
    assert create_response.status_code == 200

    logs_response = client.get("/api/logs", params={"limit": 10})
    assert logs_response.status_code == 200
    logs_body = logs_response.json()
    assert logs_body["limit"] == 10
    assert len(logs_body["items"]) >= 1

    invalid_limit_response = client.get("/api/logs", params={"limit": 201})
    assert invalid_limit_response.status_code == 422
