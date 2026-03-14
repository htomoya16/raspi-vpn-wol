from __future__ import annotations

import time

from fastapi.testclient import TestClient


def test_health_ok(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert isinstance(body["version"], str)
    assert body["version"]
    assert isinstance(body["build"], str)
    assert body["build"]


def test_pcs_crud_flow(client: TestClient) -> None:
    create_response = client.post(
        "/api/pcs",
        json={
            "id": "pc-main",
            "name": "Main PC",
            "mac": "aa-bb-cc-dd-ee-ff",
            "ip": "192.168.10.20",
            "tags": ["desk", "home"],
            "note": "my main machine",
        },
    )
    assert create_response.status_code == 201
    created = create_response.json()["pc"]
    assert created["id"] == "pc-main"
    assert created["mac"] == "AA:BB:CC:DD:EE:FF"
    assert created["status"] == "unknown"
    assert created["tags"] == ["desk", "home"]

    list_response = client.get("/api/pcs", params={"q": "main"})
    assert list_response.status_code == 200
    list_items = list_response.json()["items"]
    assert any(item["id"] == "pc-main" for item in list_items)

    get_response = client.get("/api/pcs/pc-main")
    assert get_response.status_code == 200
    assert get_response.json()["pc"]["note"] == "my main machine"

    patch_response = client.patch(
        "/api/pcs/pc-main",
        json={"name": "Main Desktop", "note": "updated"},
    )
    assert patch_response.status_code == 200
    patched = patch_response.json()["pc"]
    assert patched["name"] == "Main Desktop"
    assert patched["note"] == "updated"

    uptime_summary_response = client.get(
        "/api/pcs/pc-main/uptime/summary",
        params={"from": "2026-02-01", "to": "2026-02-03", "bucket": "day", "tz": "Asia/Tokyo"},
    )
    assert uptime_summary_response.status_code == 200

    uptime_weekly_response = client.get(
        "/api/pcs/pc-main/uptime/weekly",
        params={"week_start": "2026-02-01", "tz": "Asia/Tokyo"},
    )
    assert uptime_weekly_response.status_code == 200

    delete_response = client.delete("/api/pcs/pc-main")
    assert delete_response.status_code == 204

    missing_response = client.get("/api/pcs/pc-main")
    assert missing_response.status_code == 404


def test_pcs_duplicate_id_returns_409(client: TestClient) -> None:
    payload = {"id": "pc-dup", "name": "PC1", "mac": "00:11:22:33:44:55", "ip": "192.168.10.80"}
    first = client.post("/api/pcs", json=payload)
    second = client.post("/api/pcs", json=payload)
    assert first.status_code == 201
    assert second.status_code == 409


def test_logs_supports_filters(client: TestClient) -> None:
    create_response = client.post(
        "/api/pcs",
        json={"id": "pc-log", "name": "Log PC", "mac": "11:22:33:44:55:66", "ip": "192.168.10.81"},
    )
    assert create_response.status_code == 201

    logs_response = client.get("/api/logs", params={"pc_id": "pc-log", "limit": 10})
    assert logs_response.status_code == 200
    body = logs_response.json()
    assert len(body["items"]) >= 1
    assert all(item["pc_id"] == "pc-log" for item in body["items"])


def test_wol_job_is_accepted_and_visible(client: TestClient) -> None:
    create_response = client.post(
        "/api/pcs",
        json={"id": "pc-wol", "name": "Wol PC", "mac": "22:33:44:55:66:77", "ip": "192.168.10.82"},
    )
    assert create_response.status_code == 201

    wol_response = client.post("/api/pcs/pc-wol/wol", json={"repeat": 1})
    assert wol_response.status_code == 202
    job_id = wol_response.json()["job_id"]

    # Background execution timing is nondeterministic in tests, so allow queued/running/terminal.
    final_state = None
    for _ in range(10):
        job_response = client.get(f"/api/jobs/{job_id}")
        assert job_response.status_code == 200
        final_state = job_response.json()["job"]["state"]
        if final_state in {"succeeded", "failed"}:
            break
        time.sleep(0.05)
    assert final_state in {"queued", "running", "succeeded", "failed"}
