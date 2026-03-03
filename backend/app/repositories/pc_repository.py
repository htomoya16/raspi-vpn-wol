from __future__ import annotations

from datetime import datetime, timezone
from typing import cast

from app.db.database import connection
from app.types import PcRow


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def get_pc_by_id(pc_id: str) -> PcRow | None:
    with connection() as conn:
        row = conn.execute(
            """
            SELECT
                id,
                name,
                mac_address,
                ip_address,
                tags_json,
                note,
                status,
                last_seen_at,
                broadcast_ip,
                send_interface,
                wol_port,
                status_method,
                status_port,
                created_at,
                updated_at
            FROM pcs
            WHERE id = ?
            """,
            (pc_id,),
        ).fetchone()

    if row is None:
        return None
    return cast(PcRow, dict(row))


def get_pc_by_mac(mac_address: str) -> PcRow | None:
    with connection() as conn:
        row = conn.execute(
            """
            SELECT
                id,
                name,
                mac_address,
                ip_address,
                tags_json,
                note,
                status,
                last_seen_at,
                broadcast_ip,
                send_interface,
                wol_port,
                status_method,
                status_port,
                created_at,
                updated_at
            FROM pcs
            WHERE mac_address = ?
            """,
            (mac_address,),
        ).fetchone()

    if row is None:
        return None
    return cast(PcRow, dict(row))


def list_pcs(
    *,
    q: str | None = None,
    status: str | None = None,
    tag: str | None = None,
    cursor: str | None = None,
    limit: int | None = None,
) -> list[PcRow]:
    clauses: list[str] = []
    params: list[object] = []

    if status:
        clauses.append("status = ?")
        params.append(status)
    if cursor:
        clauses.append("id > ?")
        params.append(cursor)
    if tag:
        # tags_json is a JSON array string (e.g. ["desk","lab"]), so filter by quoted token.
        clauses.append("tags_json LIKE ? ESCAPE '\\'")
        params.append(f'%"{_escape_like(tag)}"%')
    if q:
        escaped = _escape_like(q.lower())
        pattern = f"%{escaped}%"
        clauses.append(
            "("
            "LOWER(id) LIKE ? ESCAPE '\\' "
            "OR LOWER(name) LIKE ? ESCAPE '\\' "
            "OR LOWER(mac_address) LIKE ? ESCAPE '\\' "
            "OR LOWER(COALESCE(ip_address, '')) LIKE ? ESCAPE '\\' "
            "OR LOWER(tags_json) LIKE ? ESCAPE '\\'"
            ")"
        )
        params.extend([pattern, pattern, pattern, pattern, pattern])

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    limit_sql = "LIMIT ?" if limit is not None else ""
    if limit is not None:
        params.append(limit)

    with connection() as conn:
        rows = conn.execute(
            """
            SELECT
                id,
                name,
                mac_address,
                ip_address,
                tags_json,
                note,
                status,
                last_seen_at,
                broadcast_ip,
                send_interface,
                wol_port,
                status_method,
                status_port,
                created_at,
                updated_at
            FROM pcs
            """
            + where_sql
            + """
            ORDER BY id ASC
            """
            + limit_sql,
            params,
        ).fetchall()

    return [cast(PcRow, dict(row)) for row in rows]


def upsert_pc(
    pc_id: str,
    name: str,
    mac_address: str,
    ip_address: str,
    tags_json: str,
    note: str | None,
    status: str,
    last_seen_at: str | None,
    broadcast_ip: str | None,
    send_interface: str,
    wol_port: int,
    status_method: str,
    status_port: int,
) -> PcRow:
    with connection() as conn:
        conn.execute(
            """
            INSERT INTO pcs (
                id,
                name,
                mac_address,
                ip_address,
                tags_json,
                note,
                status,
                last_seen_at,
                broadcast_ip,
                send_interface,
                wol_port,
                status_method,
                status_port
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                mac_address = excluded.mac_address,
                ip_address = excluded.ip_address,
                tags_json = excluded.tags_json,
                note = excluded.note,
                status = excluded.status,
                last_seen_at = excluded.last_seen_at,
                broadcast_ip = excluded.broadcast_ip,
                send_interface = excluded.send_interface,
                wol_port = excluded.wol_port,
                status_method = excluded.status_method,
                status_port = excluded.status_port,
                updated_at = CURRENT_TIMESTAMP
            """,
            (
                pc_id,
                name,
                mac_address,
                ip_address,
                tags_json,
                note,
                status,
                last_seen_at,
                broadcast_ip,
                send_interface,
                wol_port,
                status_method,
                status_port,
            ),
        )

    row = get_pc_by_id(pc_id)
    if row is None:
        raise ValueError(f"failed to upsert pc: {pc_id}")
    return row


def delete_pc_by_id(pc_id: str) -> bool:
    with connection() as conn:
        result = conn.execute(
            """
            DELETE FROM pcs
            WHERE id = ?
            """,
            (pc_id,),
        )
    return result.rowcount > 0


def update_pc_status(
    pc_id: str,
    status: str,
    last_seen_at: str | None = None,
) -> PcRow | None:
    updated_at = datetime.now(timezone.utc).isoformat()
    with connection() as conn:
        conn.execute(
            """
            UPDATE pcs
            SET
                status = ?,
                last_seen_at = COALESCE(?, last_seen_at),
                updated_at = ?
            WHERE id = ?
            """,
            (status, last_seen_at, updated_at, pc_id),
        )
    return get_pc_by_id(pc_id)
