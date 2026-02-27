from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient


def _create_pc(client: TestClient, *, id: str, mac: str = "AA:BB:CC:DD:EE:90") -> None:
    response = client.post(
        "/api/pcs",
        json={"id": id, "name": f"PC {id}", "mac": mac},
    )
    assert response.status_code == 201, response.text


def test_uptime_summary_day_bucket_returns_items(client: TestClient) -> None:
    _create_pc(client, id="pc-uptime-day")

    response = client.get(
        "/api/pcs/pc-uptime-day/uptime/summary",
        params={"from": "2026-02-01", "to": "2026-02-03", "bucket": "day", "tz": "Asia/Tokyo"},
    )
    assert response.status_code == 200

    body = response.json()
    assert body["pc_id"] == "pc-uptime-day"
    assert body["from"] == "2026-02-01"
    assert body["to"] == "2026-02-03"
    assert body["bucket"] == "day"
    assert len(body["items"]) == 3
    assert body["items"][0]["period_start"] == "2026-02-01"


def test_uptime_summary_week_bucket_aggregates(client: TestClient) -> None:
    _create_pc(client, id="pc-uptime-week", mac="AA:BB:CC:DD:EE:91")

    response = client.get(
        "/api/pcs/pc-uptime-week/uptime/summary",
        params={"from": "2026-02-01", "to": "2026-02-28", "bucket": "week", "tz": "Asia/Tokyo"},
    )
    assert response.status_code == 200

    body = response.json()
    assert body["bucket"] == "week"
    assert len(body["items"]) >= 4


def test_uptime_summary_error_mapping(client: TestClient) -> None:
    missing_pc_response = client.get("/api/pcs/not-found/uptime/summary")
    assert missing_pc_response.status_code == 404

    _create_pc(client, id="pc-uptime-error", mac="AA:BB:CC:DD:EE:94")
    invalid_date_response = client.get(
        "/api/pcs/pc-uptime-error/uptime/summary",
        params={"from": "2026/02/01", "to": "2026-02-03"},
    )
    assert invalid_date_response.status_code == 400


def test_uptime_weekly_timeline_returns_7_days(client: TestClient) -> None:
    _create_pc(client, id="pc-uptime-weekly", mac="AA:BB:CC:DD:EE:92")

    response = client.get(
        "/api/pcs/pc-uptime-weekly/uptime/weekly",
        params={"week_start": "2026-02-22", "tz": "Asia/Tokyo"},
    )
    assert response.status_code == 200

    body = response.json()
    assert body["week_start"] == "2026-02-22"
    assert body["week_end"] == "2026-02-28"
    assert len(body["days"]) == 7


def test_uptime_weekly_timeline_rejects_old_week(client: TestClient) -> None:
    _create_pc(client, id="pc-uptime-old", mac="AA:BB:CC:DD:EE:93")

    old_date = datetime.now(timezone.utc).date() - timedelta(days=400)
    old_week_start = (old_date - timedelta(days=(old_date.weekday() + 1) % 7)).isoformat()
    response = client.get(
        "/api/pcs/pc-uptime-old/uptime/weekly",
        params={"week_start": old_week_start, "tz": "Asia/Tokyo"},
    )
    assert response.status_code == 400


def test_uptime_weekly_timeline_rejects_non_sunday(client: TestClient) -> None:
    _create_pc(client, id="pc-uptime-non-sunday", mac="AA:BB:CC:DD:EE:95")

    response = client.get(
        "/api/pcs/pc-uptime-non-sunday/uptime/weekly",
        params={"week_start": "2026-02-25", "tz": "Asia/Tokyo"},
    )
    assert response.status_code == 400
