from __future__ import annotations

from fastapi.testclient import TestClient


def test_wol_endpoint_builds_job_payload_with_overrides(client: TestClient, monkeypatch) -> None:
    import app.api.pcs as pcs_api

    async def _fake_request_wol(pc_id: str, payload: object) -> dict[str, object]:
        assert pc_id == "pc-wol"
        assert payload is not None
        assert getattr(payload, "broadcast") == "192.168.10.255"
        assert getattr(payload, "port") == 7
        assert getattr(payload, "repeat") == 3
        return {"id": "job-wol-test", "state": "queued"}

    monkeypatch.setattr(pcs_api.wol_use_case, "request_wol", _fake_request_wol)

    response = client.post(
        "/api/pcs/pc-wol/wol",
        json={"broadcast": "192.168.10.255", "port": 7, "repeat": 3},
    )
    assert response.status_code == 202
    assert response.json() == {"job_id": "job-wol-test", "state": "queued"}


def test_wol_endpoint_validation_and_not_found(client: TestClient) -> None:
    invalid_repeat_response = client.post("/api/pcs/pc-any/wol", json={"repeat": 0})
    missing_pc_response = client.post("/api/pcs/pc-any/wol", json={"repeat": 1})

    assert invalid_repeat_response.status_code == 422
    assert missing_pc_response.status_code == 404
