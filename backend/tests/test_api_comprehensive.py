from __future__ import annotations

from collections.abc import AsyncGenerator

from fastapi.testclient import TestClient


def _create_pc(
    client: TestClient,
    *,
    id: str | None = None,
    name: str = "Main PC",
    mac: str = "AA:BB:CC:DD:EE:01",
    ip: str | None = None,
    tags: list[str] | None = None,
    note: str | None = None,
) -> dict[str, object]:
    payload: dict[str, object] = {"name": name, "mac": mac}
    if id is not None:
        payload["id"] = id
    if ip is not None:
        payload["ip"] = ip
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
        json={"id": "pc-bad", "name": "Bad", "mac": "ZZ:ZZ:ZZ:ZZ:ZZ:ZZ"},
    )
    assert bad_mac_response.status_code == 400
    assert "invalid mac address format" in bad_mac_response.json()["detail"]

    missing_name_response = client.post("/api/pcs", json={"id": "pc-miss", "mac": "AA:BB:CC:DD:EE:FF"})
    assert missing_name_response.status_code == 422

    payload = {"id": "pc-dup", "name": "Dup", "mac": "00:11:22:33:44:55"}
    first = client.post("/api/pcs", json=payload)
    second = client.post("/api/pcs", json=payload)
    assert first.status_code == 201
    assert second.status_code == 409


def test_pcs_list_filters_by_query_tag_status_and_cursor(client: TestClient) -> None:
    _create_pc(client, id="pc-a", name="Alpha", mac="AA:BB:CC:DD:EE:21", tags=["desk"])
    _create_pc(client, id="pc-b", name="Beta", mac="AA:BB:CC:DD:EE:22", tags=["lab"])
    _create_pc(client, id="pc-c", name="Gamma", mac="AA:BB:CC:DD:EE:23", tags=["desk", "lab"])

    query_response = client.get("/api/pcs", params={"q": "amm"})
    assert query_response.status_code == 200
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


def test_status_refresh_without_ip_returns_unreachable(client: TestClient) -> None:
    _create_pc(client, id="pc-no-ip", name="No IP", mac="AA:BB:CC:DD:EE:51")

    response = client.post("/api/pcs/pc-no-ip/status/refresh")
    assert response.status_code == 200
    body = response.json()["pc"]
    assert body["status"] == "unreachable"

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


def test_wol_endpoint_builds_job_payload_with_overrides(client: TestClient, monkeypatch) -> None:
    import app.api.pcs as pcs_api

    captured: dict[str, object] = {}

    def _fake_get_pc(pc_id: str) -> dict[str, object]:
        return {"id": pc_id}

    def _fake_create_job(job_type: str, payload: dict[str, object] | None) -> dict[str, object]:
        captured["job_type"] = job_type
        captured["payload"] = payload
        return {"id": "job-wol-test", "state": "queued"}

    async def _fake_run_job(*_: object, **__: object) -> None:
        return None

    async def _fake_publish(*_: object, **__: object) -> None:
        return None

    def _fake_create_task(coro: object) -> object:
        if hasattr(coro, "close"):
            coro.close()  # prevent un-awaited coroutine warnings in tests
        return object()

    monkeypatch.setattr(pcs_api.pc_service, "get_pc", _fake_get_pc)
    monkeypatch.setattr(pcs_api.job_service, "create_job", _fake_create_job)
    monkeypatch.setattr(pcs_api.job_service, "run_job", _fake_run_job)
    monkeypatch.setattr(pcs_api.event_service.event_broker, "publish", _fake_publish)
    monkeypatch.setattr(pcs_api.asyncio, "create_task", _fake_create_task)

    response = client.post(
        "/api/pcs/pc-wol/wol",
        json={"broadcast": "192.168.10.255", "port": 7, "repeat": 3},
    )
    assert response.status_code == 202
    assert response.json() == {"job_id": "job-wol-test", "state": "queued"}
    assert captured["job_type"] == "wol"
    assert captured["payload"] == {
        "pc_id": "pc-wol",
        "repeat": 3,
        "broadcast": "192.168.10.255",
        "port": 7,
    }


def test_wol_endpoint_validation_and_not_found(client: TestClient) -> None:
    invalid_repeat_response = client.post("/api/pcs/pc-any/wol", json={"repeat": 0})
    missing_pc_response = client.post("/api/pcs/pc-any/wol", json={"repeat": 1})

    assert invalid_repeat_response.status_code == 422
    assert missing_pc_response.status_code == 404


def test_refresh_all_statuses_returns_job_accepted(client: TestClient) -> None:
    response = client.post("/api/pcs/status/refresh")
    assert response.status_code == 202
    body = response.json()
    assert body["state"] == "queued"
    assert isinstance(body["job_id"], str)
    assert len(body["job_id"]) > 0

    job_response = client.get(f"/api/jobs/{body['job_id']}")
    assert job_response.status_code == 200
    assert job_response.json()["job"]["id"] == body["job_id"]


def test_jobs_endpoint_error_mapping(client: TestClient) -> None:
    not_found_response = client.get("/api/jobs/not-existing-job-id")
    blank_id_response = client.get("/api/jobs/%20%20")

    assert not_found_response.status_code == 404
    assert blank_id_response.status_code == 400


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


def test_events_endpoint_streams_sse_content(client: TestClient, monkeypatch) -> None:
    import app.api.events as events_api

    async def _fake_stream() -> AsyncGenerator[str, None]:
        yield "event: ping\ndata: {\"ok\": true}\n\n"

    monkeypatch.setattr(events_api.event_service.event_broker, "stream", _fake_stream)

    response = client.get("/api/events")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert "event: ping" in response.text
