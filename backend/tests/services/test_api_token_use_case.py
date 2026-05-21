from __future__ import annotations

from app.models.api_tokens import ApiTokenCreateRequest
from app.use_cases import api_token_use_case


def test_list_api_tokens_delegates_to_service(monkeypatch) -> None:
    tokens = [{"id": "token-1", "name": "main"}]

    monkeypatch.setattr(api_token_use_case.api_token_service, "list_tokens", lambda: tokens)

    assert api_token_use_case.list_api_tokens() == tokens


def test_create_api_token_delegates_to_service(monkeypatch) -> None:
    captured: dict[str, object] = {}
    result = {"token": {"id": "token-1"}, "plain_token": "wol_plain"}

    def _fake_create_token(name: str, expires_at: str | None, role: str | None) -> dict[str, object]:
        captured["name"] = name
        captured["expires_at"] = expires_at
        captured["role"] = role
        return result

    monkeypatch.setattr(api_token_use_case.api_token_service, "create_token", _fake_create_token)

    payload = ApiTokenCreateRequest(name="device", expires_at=None, role="device")

    assert api_token_use_case.create_api_token(payload) == result
    assert captured == {"name": "device", "expires_at": None, "role": "device"}


def test_revoke_api_token_delegates_to_service(monkeypatch) -> None:
    token = {"id": "token-1", "revoked_at": "2026-03-03T00:00:00+00:00"}

    monkeypatch.setattr(api_token_use_case.api_token_service, "revoke_token", lambda token_id: token)

    assert api_token_use_case.revoke_api_token("token-1") == token


def test_delete_api_token_delegates_to_service(monkeypatch) -> None:
    deleted = {"deleted_token_id": "token-1", "deleted": True}

    monkeypatch.setattr(api_token_use_case.api_token_service, "delete_token", lambda token_id: deleted)

    assert api_token_use_case.delete_api_token("token-1") == deleted

