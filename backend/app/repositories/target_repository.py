from __future__ import annotations

from typing import Any

from app.db.database import connection


def get_target_by_id(target_id: str) -> dict[str, Any] | None:
    with connection() as conn:
        row = conn.execute(
            """
            SELECT id, name, mac_address, ip_address, broadcast_ip, send_interface, wol_port
            FROM targets
            WHERE id = ?
            """,
            (target_id,),
        ).fetchone()

    if row is None:
        return None
    return dict(row)


def list_targets() -> list[dict[str, Any]]:
    with connection() as conn:
        rows = conn.execute(
            """
            SELECT id, name, mac_address, ip_address, broadcast_ip, send_interface, wol_port, created_at, updated_at
            FROM targets
            ORDER BY id ASC
            """
        ).fetchall()

    return [dict(row) for row in rows]


def upsert_target(
    target_id: str,
    name: str,
    mac_address: str,
    ip_address: str | None,
    broadcast_ip: str | None,
    send_interface: str,
    wol_port: int,
) -> dict[str, Any]:
    with connection() as conn:
        conn.execute(
            """
            INSERT INTO targets (id, name, mac_address, ip_address, broadcast_ip, send_interface, wol_port)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                mac_address = excluded.mac_address,
                ip_address = excluded.ip_address,
                broadcast_ip = excluded.broadcast_ip,
                send_interface = excluded.send_interface,
                wol_port = excluded.wol_port,
                updated_at = CURRENT_TIMESTAMP
            """,
            (target_id, name, mac_address, ip_address, broadcast_ip, send_interface, wol_port),
        )

    row = get_target_by_id(target_id)
    if row is None:
        raise ValueError(f"failed to upsert target: {target_id}")
    return row
