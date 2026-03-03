from __future__ import annotations

import sys

from scripts import create_api_token


def test_create_api_token_cli_calls_service_and_prints_plain_token(monkeypatch, capsys) -> None:
    captured: dict[str, object] = {}

    def _stub_migrations(_: str) -> None:
        captured["migrated"] = True

    def _stub_create_token(*, name: str, expires_at: str | None, role: str) -> dict[str, object]:
        captured["name"] = name
        captured["expires_at"] = expires_at
        captured["role"] = role
        return {
            "token": {
                "id": "token-1",
                "name": name,
                "role": role,
                "token_prefix": "wol_abcd1234",
                "created_at": "2026-03-02T00:00:00+00:00",
                "expires_at": expires_at,
                "last_used_at": None,
                "revoked_at": None,
            },
            "plain_token": "wol_plain_secret",
        }

    monkeypatch.setattr(create_api_token, "run_migrations", _stub_migrations)
    monkeypatch.setattr(create_api_token.api_token_service, "create_token", _stub_create_token)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "create_api_token.py",
            "--name",
            "break-glass-admin",
            "--role",
            "admin",
        ],
    )

    exit_code = create_api_token.main()

    assert exit_code == 0
    assert captured["migrated"] is True
    assert captured["name"] == "break-glass-admin"
    assert captured["role"] == "admin"
    assert captured["expires_at"] is None
    stdout = capsys.readouterr().out
    assert "plain_token=wol_plain_secret" in stdout
