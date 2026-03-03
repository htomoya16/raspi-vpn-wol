from __future__ import annotations

from fastapi.testclient import TestClient


def _create_pc(
    client: TestClient,
    *,
    id: str | None = None,
    name: str = "Main PC",
    mac: str = "AA:BB:CC:DD:EE:01",
    ip: str = "192.168.10.20",
    tags: list[str] | None = None,
    note: str | None = None,
) -> dict[str, object]:
    payload: dict[str, object] = {"name": name, "mac": mac, "ip": ip}
    if id is not None:
        payload["id"] = id
    if tags is not None:
        payload["tags"] = tags
    if note is not None:
        payload["note"] = note
    response = client.post("/api/pcs", json=payload)
    assert response.status_code == 201, response.text
    return response.json()["pc"]


def test_pcs_create_without_id_generates_unique_slug_ids(client: TestClient) -> None:
    first = _create_pc(client, name="Office Main", mac="AA:BB:CC:DD:EE:10")
    second = _create_pc(client, name="Office Main", mac="AA:BB:CC:DD:EE:11")

    assert str(first["id"]).startswith("office-main-")
    assert str(second["id"]).startswith("office-main-")
    assert first["id"] != second["id"]


def test_pcs_create_validation_and_conflict(client: TestClient) -> None:
    bad_mac_response = client.post(
        "/api/pcs",
        json={"id": "pc-bad", "name": "Bad", "mac": "ZZ:ZZ:ZZ:ZZ:ZZ:ZZ", "ip": "192.168.10.40"},
    )
    assert bad_mac_response.status_code == 400
    assert "invalid mac address format" in bad_mac_response.json()["detail"]

    missing_name_response = client.post(
        "/api/pcs",
        json={"id": "pc-miss", "mac": "AA:BB:CC:DD:EE:FF", "ip": "192.168.10.43"},
    )
    assert missing_name_response.status_code == 422

    payload = {"id": "pc-dup", "name": "Dup", "mac": "00:11:22:33:44:55", "ip": "192.168.10.41"}
    first = client.post("/api/pcs", json=payload)
    second = client.post("/api/pcs", json=payload)
    assert first.status_code == 201
    assert second.status_code == 409

    duplicate_mac_response = client.post(
        "/api/pcs",
        json={"id": "pc-dup-mac", "name": "DupMac", "mac": "00:11:22:33:44:55", "ip": "192.168.10.42"},
    )
    assert duplicate_mac_response.status_code == 409


def test_pcs_list_filters_by_query_tag_status_and_cursor(client: TestClient) -> None:
    _create_pc(client, id="pc-a", name="Alpha", mac="AA:BB:CC:DD:EE:21", tags=["desk"])
    _create_pc(client, id="pc-b", name="Beta", mac="AA:BB:CC:DD:EE:22", tags=["lab"])
    _create_pc(client, id="pc-c", name="Gamma", mac="AA:BB:CC:DD:EE:23", tags=["desk", "lab"])

    query_response = client.get("/api/pcs", params={"q": "amm"})
    assert query_response.status_code == 200
    assert query_response.headers["cache-control"] == "private, max-age=10, stale-while-revalidate=20"
    assert [item["id"] for item in query_response.json()["items"]] == ["pc-c"]

    tag_response = client.get("/api/pcs", params={"tag": "desk"})
    assert tag_response.status_code == 200
    assert {item["id"] for item in tag_response.json()["items"]} == {"pc-a", "pc-c"}

    status_response = client.get("/api/pcs", params={"status": "unknown"})
    assert status_response.status_code == 200
    assert len(status_response.json()["items"]) == 3

    cursor_response = client.get("/api/pcs", params={"cursor": "pc-b"})
    assert cursor_response.status_code == 200
    assert [item["id"] for item in cursor_response.json()["items"]] == ["pc-c"]

    invalid_status_response = client.get("/api/pcs", params={"status": "invalid"})
    assert invalid_status_response.status_code == 422


def test_pcs_patch_preserves_unspecified_fields(client: TestClient) -> None:
    created = _create_pc(
        client,
        id="pc-patch",
        name="Patch Me",
        mac="AA:BB:CC:DD:EE:31",
        ip="192.168.10.31",
        tags=["home", "desk"],
        note="before",
    )
    assert created["tags"] == ["home", "desk"]

    patch_response = client.patch("/api/pcs/pc-patch", json={"name": "Patched", "note": "after"})
    assert patch_response.status_code == 200
    patched = patch_response.json()["pc"]
    assert patched["name"] == "Patched"
    assert patched["note"] == "after"
    assert patched["ip"] == "192.168.10.31"
    assert patched["tags"] == ["home", "desk"]


def test_pcs_not_found_and_patch_validation(client: TestClient) -> None:
    get_missing = client.get("/api/pcs/pc-missing")
    patch_missing = client.patch("/api/pcs/pc-missing", json={"name": "x"})
    delete_missing = client.delete("/api/pcs/pc-missing")
    invalid_patch = client.patch("/api/pcs/pc-any", json={"name": ""})

    assert get_missing.status_code == 404
    assert patch_missing.status_code == 404
    assert delete_missing.status_code == 404
    assert invalid_patch.status_code == 422


def test_pcs_patch_duplicate_mac_returns_409(client: TestClient) -> None:
    _create_pc(client, id="pc-1", name="PC1", mac="AA:BB:CC:DD:EE:71")
    _create_pc(client, id="pc-2", name="PC2", mac="AA:BB:CC:DD:EE:72")

    patch_response = client.patch("/api/pcs/pc-2", json={"mac": "AA:BB:CC:DD:EE:71"})
    assert patch_response.status_code == 409


def test_delete_pc_creates_pc_delete_log(client: TestClient) -> None:
    _create_pc(client, id="pc-delete", name="Delete Me", mac="AA:BB:CC:DD:EE:41")

    delete_response = client.delete("/api/pcs/pc-delete")
    assert delete_response.status_code == 204

    logs_response = client.get(
        "/api/logs",
        params={"pc_id": "pc-delete", "action": "pc_delete", "ok": "true", "limit": 10},
    )
    assert logs_response.status_code == 200
    logs = logs_response.json()["items"]
    assert len(logs) >= 1
    assert logs[0]["action"] == "pc_delete"
    assert logs[0]["ok"] is True
