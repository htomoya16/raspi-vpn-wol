from __future__ import annotations

from datetime import datetime, timezone
from typing import cast
from uuid import uuid4

from app.db.database import connection
from app.types import ApiTokenRow


def count_active_tokens(now_iso: str) -> int:
    with connection() as conn:
        row = conn.execute(
            """
            SELECT COUNT(*) AS total
            FROM api_tokens
            WHERE revoked_at IS NULL
              AND (expires_at IS NULL OR expires_at > ?)
            """,
            (now_iso,),
        ).fetchone()
    return int(row["total"] if row is not None else 0)


def count_active_tokens_by_role(now_iso: str, role: str) -> int:
    with connection() as conn:
        row = conn.execute(
            """
            SELECT COUNT(*) AS total
            FROM api_tokens
            WHERE role = ?
              AND revoked_at IS NULL
              AND (expires_at IS NULL OR expires_at > ?)
            """,
            (role, now_iso),
        ).fetchone()
    return int(row["total"] if row is not None else 0)


def create_token(
    *,
    name: str,
    role: str,
    token_hash: str,
    token_prefix: str,
    expires_at: str | None,
) -> ApiTokenRow:
    token_id = uuid4().hex
    now_iso = datetime.now(timezone.utc).isoformat()
    with connection() as conn:
        conn.execute(
            """
            INSERT INTO api_tokens (
                id,
                name,
                role,
                token_hash,
                token_prefix,
                created_at,
                expires_at,
                last_used_at,
                revoked_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)
            """,
            (token_id, name, role, token_hash, token_prefix, now_iso, expires_at),
        )
    row = get_token(token_id)
    if row is None:
        raise ValueError(f"failed to create token: {token_id}")
    return row


def get_token(token_id: str) -> ApiTokenRow | None:
    with connection() as conn:
        row = conn.execute(
            """
            SELECT
                id,
                name,
                role,
                token_hash,
                token_prefix,
                created_at,
                expires_at,
                last_used_at,
                revoked_at
            FROM api_tokens
            WHERE id = ?
            """,
            (token_id,),
        ).fetchone()
    if row is None:
        return None
    return cast(ApiTokenRow, dict(row))


def list_tokens() -> list[ApiTokenRow]:
    with connection() as conn:
        rows = conn.execute(
            """
            SELECT
                id,
                name,
                role,
                token_hash,
                token_prefix,
                created_at,
                expires_at,
                last_used_at,
                revoked_at
            FROM api_tokens
            ORDER BY created_at DESC, id DESC
            """
        ).fetchall()
    return [cast(ApiTokenRow, dict(row)) for row in rows]


def get_active_token_by_hash(token_hash: str, now_iso: str) -> ApiTokenRow | None:
    with connection() as conn:
        row = conn.execute(
            """
            SELECT
                id,
                name,
                role,
                token_hash,
                token_prefix,
                created_at,
                expires_at,
                last_used_at,
                revoked_at
            FROM api_tokens
            WHERE token_hash = ?
              AND revoked_at IS NULL
              AND (expires_at IS NULL OR expires_at > ?)
            LIMIT 1
            """,
            (token_hash, now_iso),
        ).fetchone()
    if row is None:
        return None
    return cast(ApiTokenRow, dict(row))


def update_last_used(token_id: str, used_at: str) -> None:
    with connection() as conn:
        conn.execute(
            """
            UPDATE api_tokens
            SET last_used_at = ?
            WHERE id = ?
            """,
            (used_at, token_id),
        )


def revoke_token(token_id: str, revoked_at: str) -> bool:
    with connection() as conn:
        result = conn.execute(
            """
            UPDATE api_tokens
            SET revoked_at = ?
            WHERE id = ?
              AND revoked_at IS NULL
            """,
            (revoked_at, token_id),
        )
    return int(result.rowcount or 0) > 0


def delete_revoked_token(token_id: str) -> bool:
    with connection() as conn:
        result = conn.execute(
            """
            DELETE FROM api_tokens
            WHERE id = ?
              AND revoked_at IS NOT NULL
            """,
            (token_id,),
        )
    return int(result.rowcount or 0) > 0
