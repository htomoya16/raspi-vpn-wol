from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import secrets
from typing import Literal, cast

from app.repositories import api_token_repository

TokenRole = Literal["admin", "device"]
_ALLOWED_ROLES: set[str] = {"admin", "device"}


class AuthError(ValueError):
    pass


def has_active_tokens() -> bool:
    now_iso = datetime.now(timezone.utc).isoformat()
    return api_token_repository.count_active_tokens(now_iso) > 0


def has_active_admin_tokens() -> bool:
    now_iso = datetime.now(timezone.utc).isoformat()
    return api_token_repository.count_active_tokens_by_role(now_iso, "admin") > 0


def create_token(
    name: str,
    expires_at: str | None,
    role: str | None = None,
) -> dict[str, object]:
    normalized_name = name.strip()
    if not normalized_name:
        raise ValueError("name is required")
    if len(normalized_name) > 120:
        raise ValueError("name must be 120 characters or less")

    normalized_expires_at = _normalize_expires_at(expires_at)
    normalized_role = _normalize_role(role)
    active_tokens_exist = has_active_tokens()
    if not active_tokens_exist:
        # Prevent initial lockout: first token is always admin.
        normalized_role = "admin"
    elif normalized_role is None:
        normalized_role = "device"

    plain_token = _generate_plain_token()
    token_hash = _hash_token(plain_token)
    token_prefix = plain_token[:12]

    row = api_token_repository.create_token(
        name=normalized_name,
        role=normalized_role,
        token_hash=token_hash,
        token_prefix=token_prefix,
        expires_at=normalized_expires_at,
    )
    return {"token": _to_token(row), "plain_token": plain_token}


def list_tokens() -> list[dict[str, object]]:
    rows = api_token_repository.list_tokens()
    return [_to_token(row) for row in rows]


def revoke_token(token_id: str) -> dict[str, object]:
    normalized_id = token_id.strip()
    if not normalized_id:
        raise ValueError("token_id is required")

    row = api_token_repository.get_token(normalized_id)
    if row is None:
        raise LookupError(f"token not found: {normalized_id}")

    now_iso = datetime.now(timezone.utc).isoformat()
    if row["role"] == "admin" and _is_active_token_row(row, now_iso):
        active_admin_count = api_token_repository.count_active_tokens_by_role(now_iso, "admin")
        if active_admin_count <= 1:
            raise ValueError("cannot revoke the last active admin token")

    if row["revoked_at"] is None:
        revoked_at = now_iso
        api_token_repository.revoke_token(normalized_id, revoked_at)
        row = api_token_repository.get_token(normalized_id)
        if row is None:
            raise LookupError(f"token not found: {normalized_id}")

    return _to_token(row)


def delete_token(token_id: str) -> dict[str, object]:
    normalized_id = token_id.strip()
    if not normalized_id:
        raise ValueError("token_id is required")

    row = api_token_repository.get_token(normalized_id)
    if row is None:
        raise LookupError(f"token not found: {normalized_id}")
    if row["revoked_at"] is None:
        raise ValueError("only revoked token can be deleted")

    deleted = api_token_repository.delete_revoked_token(normalized_id)
    if not deleted:
        raise LookupError(f"token not found: {normalized_id}")

    return {"deleted_token_id": normalized_id, "deleted": True}


def authenticate_bearer_token(plain_token: str) -> dict[str, object]:
    normalized_token = plain_token.strip()
    if not normalized_token:
        raise AuthError("missing bearer token")

    now_iso = datetime.now(timezone.utc).isoformat()
    token_hash = _hash_token(normalized_token)
    row = api_token_repository.get_active_token_by_hash(token_hash, now_iso)
    if row is None:
        raise AuthError("invalid bearer token")

    api_token_repository.update_last_used(row["id"], now_iso)
    row = api_token_repository.get_token(row["id"])
    if row is None:
        raise AuthError("invalid bearer token")
    return _to_token(row)


def _generate_plain_token() -> str:
    return f"wol_{secrets.token_urlsafe(32)}"


def _hash_token(plain_token: str) -> str:
    return hashlib.sha256(plain_token.encode("utf-8")).hexdigest()


def _normalize_expires_at(value: str | None) -> str | None:
    if value is None:
        return None
    text = value.strip()
    if not text:
        return None

    normalized = text.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise ValueError("expires_at must be ISO-8601 datetime with timezone") from exc

    if parsed.tzinfo is None:
        raise ValueError("expires_at must include timezone offset")

    utc_value = parsed.astimezone(timezone.utc)
    now_utc = datetime.now(timezone.utc)
    if utc_value <= now_utc:
        raise ValueError("expires_at must be in the future")
    return utc_value.isoformat()


def _to_token(row: dict[str, object]) -> dict[str, object]:
    return {
        "id": row["id"],
        "name": row["name"],
        "role": row["role"],
        "token_prefix": row["token_prefix"],
        "created_at": row["created_at"],
        "expires_at": row.get("expires_at"),
        "last_used_at": row.get("last_used_at"),
        "revoked_at": row.get("revoked_at"),
    }


def _normalize_role(value: str | None) -> TokenRole | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    if not normalized:
        return None
    if normalized not in _ALLOWED_ROLES:
        raise ValueError("role must be one of: admin, device")
    return cast(TokenRole, normalized)


def _is_active_token_row(row: dict[str, object], now_iso: str) -> bool:
    if row.get("revoked_at") is not None:
        return False
    expires_at = row.get("expires_at")
    return expires_at is None or str(expires_at) > now_iso
