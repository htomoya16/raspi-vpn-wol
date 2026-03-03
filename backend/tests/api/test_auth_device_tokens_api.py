from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.services import api_token_service


def test_health_is_public(client_without_auth_header: TestClient) -> None:
    response = client_without_auth_header.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_protected_api_requires_bearer_token(client_without_auth_header: TestClient) -> None:
    response = client_without_auth_header.get("/api/pcs")
    assert response.status_code == 401
    assert response.json()["detail"] == "invalid bearer token"


def test_auth_me_requires_bearer_token(client_without_auth_header: TestClient) -> None:
    response = client_without_auth_header.get("/api/auth/me")
    assert response.status_code == 401
    assert response.json()["detail"] == "invalid bearer token"


def test_query_token_is_not_accepted_for_non_sse_endpoint(client_without_auth_header: TestClient) -> None:
    issued = api_token_service.create_token(name="pytest-query-token", expires_at=None)
    response = client_without_auth_header.get(f"/api/pcs?token={issued['plain_token']}")
    assert response.status_code == 401
    assert response.json()["detail"] == "invalid bearer token"


def test_auth_me_returns_current_token_context(client: TestClient) -> None:
    create_response = client.post(
        "/api/admin/tokens",
        json={"name": "iphone-shortcut", "expires_at": None},
    )
    assert create_response.status_code == 201
    created = create_response.json()
    headers = {"Authorization": f"Bearer {created['plain_token']}"}

    response = client.get("/api/auth/me", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["token_name"] == "iphone-shortcut"
    assert body["token_role"] == "device"
    assert isinstance(body["token_id"], str)
    assert body["token_id"]


def test_admin_token_lifecycle_and_revoked_token_is_rejected(client: TestClient) -> None:
    create_response = client.post(
        "/api/admin/tokens",
        json={"name": "iphone-shortcut", "expires_at": None},
    )
    assert create_response.status_code == 201
    created = create_response.json()
    plain_token = created["plain_token"]
    token_id = created["token"]["id"]
    assert created["token"]["role"] == "device"

    list_response = client.get("/api/admin/tokens")
    assert list_response.status_code == 200
    items = list_response.json()["items"]
    assert any(item["id"] == token_id for item in items)
    assert all("plain_token" not in item for item in items)

    auth_headers = {"Authorization": f"Bearer {plain_token}"}
    with_new_token = client.get("/api/pcs", headers=auth_headers)
    assert with_new_token.status_code == 200

    revoke_response = client.post(f"/api/admin/tokens/{token_id}/revoke")
    assert revoke_response.status_code == 200
    assert revoke_response.json()["token"]["revoked_at"] is not None

    after_revoke = client.get("/api/pcs", headers=auth_headers)
    assert after_revoke.status_code == 401
    assert after_revoke.json()["detail"] == "invalid bearer token"


def test_admin_api_is_forbidden_for_device_token(client: TestClient) -> None:
    create_response = client.post(
        "/api/admin/tokens",
        json={"name": "iphone-shortcut", "expires_at": None},
    )
    assert create_response.status_code == 201
    created = create_response.json()
    device_headers = {"Authorization": f"Bearer {created['plain_token']}"}

    forbidden_response = client.get("/api/admin/tokens", headers=device_headers)
    assert forbidden_response.status_code == 403
    assert forbidden_response.json()["detail"] == "insufficient scope"

    pcs_response = client.get("/api/pcs", headers=device_headers)
    assert pcs_response.status_code == 200


def test_create_token_rejects_invalid_or_past_expires_at(client: TestClient) -> None:
    invalid_format = client.post(
        "/api/admin/tokens",
        json={"name": "bad-expire", "expires_at": "2026-03-02T00:00:00"},
    )
    assert invalid_format.status_code == 400

    past_value = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    past_response = client.post(
        "/api/admin/tokens",
        json={"name": "past-expire", "expires_at": past_value},
    )
    assert past_response.status_code == 400


def test_revoke_last_active_admin_token_is_blocked(client: TestClient) -> None:
    list_response = client.get("/api/admin/tokens")
    assert list_response.status_code == 200
    admins = [item for item in list_response.json()["items"] if item["role"] == "admin" and item["revoked_at"] is None]
    assert len(admins) == 1

    revoke_response = client.post(f"/api/admin/tokens/{admins[0]['id']}/revoke")
    assert revoke_response.status_code == 400
    assert revoke_response.json()["detail"] == "cannot revoke the last active admin token"


def test_admin_token_can_be_created_with_role(client: TestClient) -> None:
    response = client.post(
        "/api/admin/tokens",
        json={"name": "break-glass", "role": "admin", "expires_at": None},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["token"]["role"] == "admin"


def test_delete_token_requires_revoked_state(client: TestClient) -> None:
    create_response = client.post(
        "/api/admin/tokens",
        json={"name": "delete-target", "expires_at": None},
    )
    assert create_response.status_code == 201
    token_id = create_response.json()["token"]["id"]

    active_delete = client.delete(f"/api/admin/tokens/{token_id}")
    assert active_delete.status_code == 400
    assert active_delete.json()["detail"] == "only revoked token can be deleted"

    revoke_response = client.post(f"/api/admin/tokens/{token_id}/revoke")
    assert revoke_response.status_code == 200
    assert revoke_response.json()["token"]["revoked_at"] is not None

    delete_response = client.delete(f"/api/admin/tokens/{token_id}")
    assert delete_response.status_code == 200
    assert delete_response.json() == {"deleted_token_id": token_id, "deleted": True}

    list_response = client.get("/api/admin/tokens")
    assert list_response.status_code == 200
    assert all(item["id"] != token_id for item in list_response.json()["items"])


def test_delete_token_returns_404_when_not_found(client: TestClient) -> None:
    response = client.delete("/api/admin/tokens/not-found-token")
    assert response.status_code == 404
