from __future__ import annotations

from fastapi.testclient import TestClient


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


def test_refresh_all_statuses_reuses_active_job(client: TestClient, monkeypatch) -> None:
    import app.api.pcs as pcs_api

    def _fail_create_job(*args: object, **kwargs: object) -> dict[str, object]:
        raise AssertionError("create_job should not be called")

    monkeypatch.setattr(
        pcs_api.job_service,
        "get_active_job_by_type",
        lambda _: {"id": "job-active", "state": "running"},
    )
    monkeypatch.setattr(
        pcs_api.job_service,
        "create_job",
        _fail_create_job,
    )

    response = client.post("/api/pcs/status/refresh")
    assert response.status_code == 202
    assert response.json() == {"job_id": "job-active", "state": "running"}
