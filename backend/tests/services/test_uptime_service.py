from __future__ import annotations

from datetime import datetime, timezone

from app.services import uptime_service


def test_uptime_summary_day_bucket_calculates_online_seconds(monkeypatch) -> None:
    monkeypatch.setattr(
        uptime_service.pc_repository,
        "get_pc_by_id",
        lambda _pc_id: {"id": "pc-1", "status": "offline"},
    )

    monkeypatch.setattr(uptime_service, "_utcnow", lambda: datetime(2026, 2, 5, tzinfo=timezone.utc))
    monkeypatch.setattr(uptime_service.uptime_repository, "get_latest_status_before", lambda *_: None)
    monkeypatch.setattr(uptime_service.uptime_repository, "list_daily_summary", lambda **_: [])
    monkeypatch.setattr(
        uptime_service.uptime_repository,
        "list_status_history_between",
        lambda *_: [
            {
                "changed_at": "2026-02-01T01:00:00+00:00",
                "status": "online",
            },
            {
                "changed_at": "2026-02-01T03:00:00+00:00",
                "status": "offline",
            },
        ],
    )

    upserts: list[dict[str, object]] = []
    monkeypatch.setattr(
        uptime_service.uptime_repository,
        "upsert_daily_summary",
        lambda **kwargs: upserts.append(kwargs),
    )

    response = uptime_service.get_pc_uptime_summary(
        pc_id="pc-1",
        from_date="2026-02-01",
        to_date="2026-02-01",
        bucket="day",
        tz_name="UTC",
    )

    assert response["pc_id"] == "pc-1"
    assert response["bucket"] == "day"
    assert response["items"][0]["online_seconds"] == 7200
    assert response["items"][0]["online_ratio"] == 0.0833
    assert len(upserts) == 1
    assert upserts[0]["online_seconds"] == 7200


def test_weekly_timeline_returns_intervals(monkeypatch) -> None:
    monkeypatch.setattr(
        uptime_service.pc_repository,
        "get_pc_by_id",
        lambda _pc_id: {"id": "pc-1", "status": "offline"},
    )

    monkeypatch.setattr(uptime_service, "_utcnow", lambda: datetime(2026, 2, 10, tzinfo=timezone.utc))
    monkeypatch.setattr(uptime_service.uptime_repository, "get_latest_status_before", lambda *_: None)
    monkeypatch.setattr(
        uptime_service.uptime_repository,
        "list_status_history_between",
        lambda *_: [
            {
                "changed_at": "2026-02-03T04:00:00+00:00",
                "status": "online",
            },
            {
                "changed_at": "2026-02-03T06:30:00+00:00",
                "status": "offline",
            },
        ],
    )

    response = uptime_service.get_pc_weekly_timeline(
        pc_id="pc-1",
        week_start="2026-02-01",
        tz_name="UTC",
    )

    assert response["week_start"] == "2026-02-01"
    assert response["week_end"] == "2026-02-07"
    assert len(response["days"]) == 7

    target = next(day for day in response["days"] if day["date"] == "2026-02-03")
    assert target["online_seconds"] == 9000
    assert target["intervals"] == [
        {
            "start": "04:00",
            "end": "06:30",
            "duration_seconds": 9000,
        }
    ]


def test_uptime_summary_uses_cached_daily_data_for_out_of_retention_range(monkeypatch) -> None:
    monkeypatch.setattr(
        uptime_service.pc_repository,
        "get_pc_by_id",
        lambda _pc_id: {"id": "pc-1", "status": "offline"},
    )
    monkeypatch.setattr(uptime_service, "_utcnow", lambda: datetime(2026, 2, 10, tzinfo=timezone.utc))

    monkeypatch.setattr(
        uptime_service.uptime_repository,
        "list_daily_summary",
        lambda **_: [
            {
                "pc_id": "pc-1",
                "date": "2020-12-01",
                "tz": "UTC",
                "online_seconds": 5400,
                "online_count": 1,
                "offline_count": 0,
                "first_online_at": None,
                "last_online_at": None,
                "created_at": "2020-12-02T00:00:00+00:00",
                "updated_at": "2020-12-02T00:00:00+00:00",
            }
        ],
    )
    monkeypatch.setattr(
        uptime_service.uptime_repository,
        "list_status_history_between",
        lambda *_: [],
    )
    monkeypatch.setattr(
        uptime_service.uptime_repository,
        "get_latest_status_before",
        lambda *_: None,
    )
    monkeypatch.setattr(
        uptime_service.uptime_repository,
        "upsert_daily_summary",
        lambda **_: (_ for _ in ()).throw(AssertionError("upsert should not be called")),
    )

    response = uptime_service.get_pc_uptime_summary(
        pc_id="pc-1",
        from_date="2020-12-01",
        to_date="2020-12-01",
        bucket="day",
        tz_name="UTC",
    )

    assert response["items"] == [
        {
            "label": "2020-12-01",
            "period_start": "2020-12-01",
            "period_end": "2020-12-01",
            "online_seconds": 5400,
            "online_ratio": 0.0625,
        }
    ]


def test_uptime_summary_does_not_assume_full_online_when_history_is_empty(monkeypatch) -> None:
    monkeypatch.setattr(
        uptime_service.pc_repository,
        "get_pc_by_id",
        lambda _pc_id: {"id": "pc-1", "status": "online"},
    )
    monkeypatch.setattr(uptime_service, "_utcnow", lambda: datetime(2026, 3, 3, 12, 0, tzinfo=timezone.utc))
    monkeypatch.setattr(uptime_service.uptime_repository, "get_latest_status_before", lambda *_: None)
    monkeypatch.setattr(uptime_service.uptime_repository, "list_status_history_between", lambda *_: [])
    monkeypatch.setattr(uptime_service.uptime_repository, "list_daily_summary", lambda **_: [])

    upserts: list[dict[str, object]] = []
    monkeypatch.setattr(
        uptime_service.uptime_repository,
        "upsert_daily_summary",
        lambda **kwargs: upserts.append(kwargs),
    )

    response = uptime_service.get_pc_uptime_summary(
        pc_id="pc-1",
        from_date="2026-03-01",
        to_date="2026-03-01",
        bucket="day",
        tz_name="UTC",
    )

    assert response["items"] == [
        {
            "label": "2026-03-01",
            "period_start": "2026-03-01",
            "period_end": "2026-03-01",
            "online_seconds": 0,
            "online_ratio": 0.0,
        }
    ]
    assert len(upserts) == 1
    assert upserts[0]["online_seconds"] == 0
