from __future__ import annotations

from fastapi.testclient import TestClient


def _create_pc(
    client: TestClient,
    *,
    id: str,
    name: str,
    mac: str,
) -> None:
    response = client.post(
        "/api/pcs",
        json={"id": id, "name": name, "mac": mac},
    )
    assert response.status_code == 201, response.text


def test_logs_filters_validation_and_cursor(client: TestClient) -> None:
    _create_pc(client, id="pc-log", name="Log", mac="AA:BB:CC:DD:EE:61")
    client.patch("/api/pcs/pc-log", json={"note": "first update"})
    client.patch("/api/pcs/pc-log", json={"note": "second update"})

    invalid_limit = client.get("/api/logs", params={"limit": 201})
    invalid_cursor = client.get("/api/logs", params={"cursor": 0})
    assert invalid_limit.status_code == 422
    assert invalid_cursor.status_code == 422

    first_page = client.get("/api/logs", params={"pc_id": "pc-log", "action": "pc_upsert", "limit": 1})
    assert first_page.status_code == 200
    first_body = first_page.json()
    assert len(first_body["items"]) == 1
    assert first_body["items"][0]["action"] == "pc_upsert"
    assert first_body["items"][0]["ok"] is True
    assert first_body["next_cursor"] is not None

    second_page = client.get(
        "/api/logs",
        params={
            "pc_id": "pc-log",
            "action": "pc_upsert",
            "limit": 5,
            "cursor": first_body["next_cursor"],
        },
    )
    assert second_page.status_code == 200
    second_items = second_page.json()["items"]
    assert len(second_items) >= 1
    assert all(item["id"] < first_body["next_cursor"] for item in second_items)
