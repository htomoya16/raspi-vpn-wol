from __future__ import annotations

from datetime import datetime, timezone
from typing import TypedDict, cast
from uuid import uuid4

from app.db.database import connection


class PcSshSettingsRow(TypedDict):
    pc_id: str
    username: str
    port: int
    enabled: int
    key_id: str
    host_key: str | None
    verified_ip: str | None
    verified_at: str | None
    revision: int


def get_pc_ssh_settings(pc_id: str) -> PcSshSettingsRow | None:
    """PC別のSSH設定を取得する。

    Args:
        pc_id: 対象PCのID。

    Returns:
        保存済み設定。未設定の場合はNone。
    """
    with connection() as conn:
        row = conn.execute("SELECT * FROM pc_ssh_settings WHERE pc_id = ?", (pc_id,)).fetchone()
    return cast(PcSshSettingsRow, dict(row)) if row else None


def save_pc_ssh_settings(pc_id: str, username: str, port: int, enabled: bool) -> PcSshSettingsRow:
    """SSH設定を保存し、接続条件が変わった場合は確認結果を取り消す。

    Args:
        pc_id: 対象PCのID。
        username: WindowsのSSHユーザー名。
        port: SSHポート。
        enabled: 接続確認後に停止操作を許可するかどうか。

    Returns:
        保存後の設定。既存の鍵IDは保持する。
    """
    with connection() as conn:
        conn.execute("BEGIN IMMEDIATE")
        conn.execute(
            """INSERT INTO pc_ssh_settings (pc_id, username, port, enabled, key_id)
               SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM pcs WHERE id = ?)
               ON CONFLICT(pc_id) DO UPDATE SET
                 host_key = CASE WHEN username = excluded.username AND port = excluded.port THEN host_key ELSE NULL END,
                 verified_ip = CASE WHEN username = excluded.username AND port = excluded.port THEN verified_ip ELSE NULL END,
                 verified_at = CASE WHEN username = excluded.username AND port = excluded.port THEN verified_at ELSE NULL END,
                 username = excluded.username, port = excluded.port, enabled = excluded.enabled,
                 revision = revision + 1""",
            (pc_id, username, port, int(enabled), uuid4().hex, pc_id),
        )
    row = get_pc_ssh_settings(pc_id)
    if row is None:
        raise LookupError("SSH設定が見つかりません")
    return row


def save_confirmed_host_key(pc_id: str, host_key: str, ip: str, revision: int) -> bool:
    """取得時のPC情報が変わっていない場合に、確認済みホスト鍵を保存する。

    Args:
        pc_id: 対象PCのID。
        host_key: 管理者が指紋を照合した公開ホスト鍵。
        ip: ホスト鍵取得時のIP。
        revision: ホスト鍵取得時の設定版。

    Returns:
        設定が一致し、保存できた場合にTrue。
    """
    with connection() as conn:
        result = conn.execute(
            """UPDATE pc_ssh_settings SET host_key = ?, verified_ip = NULL,
                 verified_at = NULL, revision = revision + 1
               WHERE pc_id = ? AND revision = ?
                 AND EXISTS (SELECT 1 FROM pcs WHERE id = ? AND ip_address = ?)""",
            (host_key, pc_id, revision, pc_id, ip),
        )
    return result.rowcount == 1


def record_ssh_verification(pc_id: str, ip: str, revision: int, succeeded: bool) -> bool:
    """接続確認結果を、確認に使った設定が今も有効な場合だけ保存する。

    Args:
        pc_id: 対象PCのID。
        ip: 接続確認したIP。
        revision: 接続確認に使った設定版。
        succeeded: 接続確認に成功したかどうか。

    Returns:
        設定が一致し、結果を保存できた場合にTrue。
    """
    verified_at = datetime.now(timezone.utc).isoformat() if succeeded else None
    with connection() as conn:
        result = conn.execute(
            """UPDATE pc_ssh_settings SET verified_ip = ?, verified_at = ?
               WHERE pc_id = ? AND revision = ?
                 AND EXISTS (SELECT 1 FROM pcs WHERE id = ? AND ip_address = ?)""",
            (ip if succeeded else None, verified_at, pc_id, revision, pc_id, ip),
        )
    return result.rowcount == 1
