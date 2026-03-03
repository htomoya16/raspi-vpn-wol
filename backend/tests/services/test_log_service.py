from __future__ import annotations

import json

from app.security import set_current_api_actor, reset_current_api_actor
from app.services import job_context, log_service


def test_insert_log_adds_job_id_from_context(monkeypatch) -> None:
    captured: list[dict[str, object | None]] = []

    def _capture_insert_log_row(
        *,
        action: str,
        pc_id: str,
        status: str,
        event_kind: str,
        job_id: str | None,
        api_token_id: str | None,
        actor_label: str | None,
        message: str | None,
        details_json: str | None,
    ) -> None:
        captured.append(
            {
                "action": action,
                "pc_id": pc_id,
                "status": status,
                "event_kind": event_kind,
                "job_id": job_id,
                "api_token_id": api_token_id,
                "actor_label": actor_label,
                "message": message,
                "details_json": details_json,
            }
        )

    monkeypatch.setattr(log_service.log_repository, "insert_log_row", _capture_insert_log_row)

    token = job_context.set_current_job_id("job-123")
    try:
        log_service.insert_log(
            action="status",
            pc_id="pc-1",
            status="offline",
            message="tcp timeout",
            details={"probe": "tcp"},
        )
    finally:
        job_context.reset_current_job_id(token)

    assert len(captured) == 1
    assert captured[0]["job_id"] == "job-123"
    assert captured[0]["event_kind"] == "normal"
    assert captured[0]["api_token_id"] is None
    assert captured[0]["actor_label"] is None
    details = json.loads(str(captured[0]["details_json"]))
    assert details["probe"] == "tcp"


def test_insert_log_keeps_details_payload_unchanged(monkeypatch) -> None:
    captured: list[dict[str, object | None]] = []

    monkeypatch.setattr(
        log_service.log_repository,
        "insert_log_row",
        lambda **kwargs: captured.append(kwargs),
    )

    token = job_context.set_current_job_id("job-runtime")
    try:
        log_service.insert_log(
            action="status",
            pc_id="pc-1",
            status="offline",
            details={"job_id": "job-fixed", "source": "manual"},
        )
    finally:
        job_context.reset_current_job_id(token)

    assert len(captured) == 1
    assert captured[0]["job_id"] == "job-runtime"
    details = json.loads(str(captured[0]["details_json"]))
    assert details["job_id"] == "job-fixed"
    assert details["source"] == "manual"


def test_insert_log_adds_actor_from_context(monkeypatch) -> None:
    captured: list[dict[str, object | None]] = []

    monkeypatch.setattr(
        log_service.log_repository,
        "insert_log_row",
        lambda **kwargs: captured.append(kwargs),
    )

    actor_token = set_current_api_actor(
        {"token_id": "token-1", "token_name": "iphone-shortcut", "token_role": "device"}
    )
    try:
        log_service.insert_log(
            action="wol",
            pc_id="pc-1",
            status="sent",
        )
    finally:
        reset_current_api_actor(actor_token)

    assert len(captured) == 1
    assert captured[0]["api_token_id"] == "token-1"
    assert captured[0]["actor_label"] == "iphone-shortcut"
