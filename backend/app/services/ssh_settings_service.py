from __future__ import annotations

import base64
import fcntl
import hashlib
import hmac
import ipaddress
import os
import re
import subprocess
import tempfile
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator
from urllib.parse import quote

from app.cache import cache
from app.cache import keys as cache_keys
from app.models.ssh_settings import HostKeyConfirmation, PcSshSettingsUpdate
from app.repositories import pc_repository, ssh_settings_repository
from app.repositories.ssh_settings_repository import PcSshSettingsRow
from app.services.log_service import insert_log
from app.types import PcRow


class ShutdownUnavailableError(ValueError):
    """設定不足や接続失敗により、SSHでの停止処理を続けられない場合の例外。"""


@dataclass(frozen=True)
class ShutdownSshSettings:
    """登録済みIPと、確認済みのPC別SSH設定を合わせた接続情報。"""

    ip_address: str
    username: str
    port: int
    identity_file: str
    known_hosts_file: str
    host_key_alias: str
    revision: int


def get_registered_pc(pc_id: str) -> PcRow:
    """登録済みPCを取得し、LAN内のIPv4アドレスを検証する。

    Args:
        pc_id: 対象PCのID。

    Returns:
        IPを含む登録済みPC情報。

    Raises:
        LookupError: PCが存在しない場合。
        ShutdownUnavailableError: 接続先IPが不正な場合。
    """
    pc = pc_repository.get_pc_by_id(pc_id)
    if pc is None:
        raise LookupError("PCが見つかりません")
    try:
        target = ipaddress.IPv4Address(pc["ip_address"])
    except ipaddress.AddressValueError as exc:
        raise ShutdownUnavailableError("PCのIP設定を確認してください") from exc
    if not target.is_private or target.is_loopback or target.is_multicast or target.is_unspecified:
        raise ShutdownUnavailableError("PCのIP設定を確認してください")
    return pc


def _get_key_directory(settings: PcSshSettingsRow) -> Path:
    """API入力のパスを使わず、DBの鍵IDから保存先を決める。

    Args:
        settings: 保存済みのSSH設定。

    Returns:
        リポジトリ外にある、PC別の鍵ディレクトリ。

    Raises:
        ShutdownUnavailableError: 保存済み鍵IDが不正な場合。
    """
    if not re.fullmatch(r"[a-f0-9]{32}", settings["key_id"]):
        raise ShutdownUnavailableError("SSH鍵の設定を確認してください")
    root = Path(os.getenv("WOL_SSH_KEY_DIR", "/var/lib/wol/ssh"))
    return root / settings["key_id"]


@contextmanager
def _lock_key_directory(directory: Path) -> Iterator[None]:
    """鍵の生成・保存を、プロセスをまたいで直列化する。

    Args:
        directory: PC別の鍵ディレクトリ。

    Yields:
        ディレクトリへの排他的な書き込み権限。
    """
    directory.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    directory.mkdir(exist_ok=True, mode=0o700)
    directory.chmod(0o700)
    with (directory / ".lock").open("a") as lock_file:
        os.chmod(lock_file.name, 0o600)
        fcntl.flock(lock_file, fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(lock_file, fcntl.LOCK_UN)


def _invalidate_pc_cache() -> None:
    """SSH設定の変更がPC一覧へ反映されるよう、一覧キャッシュを削除する。"""
    cache.invalidate_prefix(cache_keys.PCS_LIST_PREFIX)


def _get_host_key_file(settings: PcSshSettingsRow) -> Path:
    """確認済みの鍵内容から、ホスト鍵ファイルの保存先を決める。

    Args:
        settings: ホスト鍵を含む保存済み設定。

    Returns:
        鍵内容ごとの保存先。実行中の古い接続情報を上書きしない。

    Raises:
        ShutdownUnavailableError: ホスト鍵が未確認の場合。
    """
    if not settings["host_key"]:
        raise ShutdownUnavailableError("PCのホスト鍵を確認してください")
    get_host_key_fingerprint(settings["host_key"])
    digest = hashlib.sha256(settings["host_key"].encode()).hexdigest()
    return _get_key_directory(settings) / f"known_hosts-{digest}"


def save_ssh_settings(pc_id: str, payload: PcSshSettingsUpdate) -> dict[str, object]:
    """ユーザー名・ポート・有効設定を保存する。秘密鍵は保持する。

    Args:
        pc_id: 対象PCのID。
        payload: 管理者が入力したSSH設定。

    Returns:
        保存後の画面向け設定情報。
    """
    get_registered_pc(pc_id)
    ssh_settings_repository.save_pc_ssh_settings(pc_id, payload.username, payload.port, payload.enabled)
    _invalidate_pc_cache()
    insert_log("ssh_setup", pc_id, "ok", message="SSH設定を保存しました")
    return get_ssh_settings(pc_id)


def get_ssh_settings(pc_id: str) -> dict[str, object]:
    """秘密鍵や保存パスを含めず、設定画面に必要な情報を返す。

    Args:
        pc_id: 対象PCのID。

    Returns:
        SSH設定、公開鍵、Windows登録コマンド、接続確認の状態。
    """
    pc = get_registered_pc(pc_id)
    settings = ssh_settings_repository.get_pc_ssh_settings(pc_id)
    response: dict[str, object] = {"pc_id": pc_id, "ip": pc["ip_address"]}
    if settings is None:
        return response
    public_file = _get_key_directory(settings) / "identity.pub"
    public_key = public_file.read_text().strip() if public_file.is_file() else None
    response.update({
        "username": settings["username"], "port": settings["port"], "enabled": bool(settings["enabled"]),
        "public_key": public_key,
        "host_fingerprint": get_host_key_fingerprint(settings["host_key"]) if settings["host_key"] else None,
        "verified": bool(settings["verified_at"] and settings["verified_ip"] == pc["ip_address"]),
        "verified_at": settings["verified_at"] if settings["verified_ip"] == pc["ip_address"] else None,
        "setup_script": build_windows_key_registration_script(settings["username"], public_key) if public_key else None,
    })
    return response


def generate_pc_ssh_key(pc_id: str) -> dict[str, object]:
    """PC別の鍵を一度だけ生成し、再要求では既存の公開鍵を返す。

    Args:
        pc_id: 対象PCのID。

    Returns:
        生成済み公開鍵を含む、画面向けのSSH設定。

    Raises:
        ShutdownUnavailableError: 未設定、既存鍵が不完全、または鍵生成に失敗した場合。
    """
    get_registered_pc(pc_id)
    settings = ssh_settings_repository.get_pc_ssh_settings(pc_id)
    if settings is None:
        raise ShutdownUnavailableError("先にSSHユーザー名を保存してください")
    directory = _get_key_directory(settings)
    try:
        with _lock_key_directory(directory):
            private_file, public_file = directory / "identity", directory / "identity.pub"
            if private_file.exists() or public_file.exists():
                if not private_file.is_file() or not public_file.is_file():
                    raise ShutdownUnavailableError("既存のSSH鍵が不完全です。鍵を復元してください")
            else:
                # 一時ディレクトリで生成を完了してから配置し、既存の鍵は上書きしない。
                with tempfile.TemporaryDirectory(dir=directory) as temp_dir:
                    generated = Path(temp_dir) / "identity"
                    result = subprocess.run(
                        ["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-C", "wol-dashboard", "-f", str(generated)],
                        capture_output=True, text=True, timeout=10, check=False,
                    )
                    if result.returncode != 0:
                        raise ShutdownUnavailableError("SSH鍵の生成に失敗しました")
                    generated.chmod(0o600)
                    Path(f"{generated}.pub").chmod(0o600)
                    os.replace(generated, private_file)
                    os.replace(Path(f"{generated}.pub"), public_file)
            private_file.chmod(0o600)
            public_file.chmod(0o600)
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise ShutdownUnavailableError("SSH鍵を作成できません。SSHツールと保存先の権限を確認してください") from exc
    insert_log("ssh_setup", pc_id, "ok", message="SSH公開鍵を用意しました（既存鍵は保持）")
    _invalidate_pc_cache()
    return get_ssh_settings(pc_id)


def get_host_key_fingerprint(host_key: str) -> str:
    """Ed25519ホスト鍵を検証し、SSHのSHA256指紋を算出する。

    Args:
        host_key: アルゴリズム名とBase64公開鍵の組。

    Returns:
        SHA256:で始まる指紋。

    Raises:
        ShutdownUnavailableError: 鍵の形式やアルゴリズムが不正な場合。
    """
    try:
        algorithm, encoded = host_key.split()
        raw = base64.b64decode(encoded, validate=True)
        if algorithm != "ssh-ed25519" or len(raw) != 51 or raw[:19] != b'\x00\x00\x00\x0bssh-ed25519\x00\x00\x00\x20':
            raise ValueError("invalid host key")
        digest = base64.b64encode(hashlib.sha256(raw).digest()).decode().rstrip("=")
        return f"SHA256:{digest}"
    except (ValueError, TypeError) as exc:
        raise ShutdownUnavailableError("ホスト鍵の形式を確認してください") from exc


def scan_pc_host_key(pc_id: str) -> dict[str, object]:
    """登録済みPCから候補のホスト鍵を取得する。取得だけでは信頼しない。

    Args:
        pc_id: 対象PCのID。

    Returns:
        候補の公開鍵と指紋、および取得時のIPと設定版。

    Raises:
        ShutdownUnavailableError: 未設定、またはホスト鍵を取得できない場合。
    """
    pc = get_registered_pc(pc_id)
    settings = ssh_settings_repository.get_pc_ssh_settings(pc_id)
    if settings is None:
        raise ShutdownUnavailableError("先にSSHユーザー名を保存してください")
    try:
        result = subprocess.run(
            ["ssh-keyscan", "-T", "5", "-p", str(settings["port"]), "-t", "ed25519", pc["ip_address"]],
            capture_output=True, text=True, timeout=10, check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise ShutdownUnavailableError("ホスト鍵を取得できません。PCのSSH設定を確認してください") from exc
    candidates = {" ".join(line.split()[1:3]) for line in result.stdout.splitlines() if line.strip() and not line.startswith("#") and len(line.split()) == 3}
    if result.returncode != 0 or len(candidates) != 1:
        raise ShutdownUnavailableError("ホスト鍵を取得できません。PCのSSH設定を確認してください")
    host_key = candidates.pop()
    return {"host_key": host_key, "fingerprint": get_host_key_fingerprint(host_key), "ip": pc["ip_address"], "revision": settings["revision"]}


def confirm_pc_host_key(pc_id: str, payload: HostKeyConfirmation) -> dict[str, object]:
    """PC側で確認した指紋と一致する場合だけ、ホスト鍵を保存する。

    Args:
        pc_id: 対象PCのID。
        payload: 候補鍵と、管理者がPC側で確認した指紋。

    Returns:
        保存後の画面向けSSH設定。

    Raises:
        ShutdownUnavailableError: 指紋が一致しない、または取得後に設定が変わった場合。
    """
    get_registered_pc(pc_id)
    fingerprint = get_host_key_fingerprint(payload.host_key)
    if not hmac.compare_digest(fingerprint, payload.fingerprint.strip()):
        raise ShutdownUnavailableError("PC側のホスト鍵の指紋と一致しません")
    if not ssh_settings_repository.save_confirmed_host_key(pc_id, payload.host_key, payload.ip, payload.revision):
        raise ShutdownUnavailableError("PCまたはSSH設定が変更されました。ホスト鍵を再取得してください")
    # ファイル保存に失敗した場合も、取り消した接続確認を一覧へ反映する。
    _invalidate_pc_cache()
    settings = ssh_settings_repository.get_pc_ssh_settings(pc_id)
    if settings is None:
        raise LookupError("SSH設定が見つかりません")
    host_file = _get_host_key_file(settings)
    with _lock_key_directory(host_file.parent):
        # 完成した内容を配置する。再登録で壊れたファイルも復旧できる。
        with tempfile.TemporaryDirectory(dir=host_file.parent) as temp_dir:
            generated = Path(temp_dir) / "known_hosts"
            generated.write_text(f"wol-pc-{quote(pc_id, safe='')} {settings['host_key']}\n")
            generated.chmod(0o600)
            os.replace(generated, host_file)
    insert_log("ssh_setup", pc_id, "ok", message="照合済みのホスト鍵を保存しました")
    return get_ssh_settings(pc_id)


def load_pc_ssh_connection(pc_id: str, ip_address: str, *, require_verified: bool = True) -> ShutdownSshSettings:
    """PC情報と保存済み設定から、安全に接続できる情報を組み立てる。

    Args:
        pc_id: 対象PCのID。
        ip_address: PC情報に登録されているIP。
        require_verified: 停止操作用に接続確認済みの状態を要求するかどうか。

    Returns:
        秘密鍵と確認済みホスト鍵に対応する接続情報。

    Raises:
        ShutdownUnavailableError: 設定、鍵、ホスト鍵、または接続確認が不足している場合。
    """
    settings = ssh_settings_repository.get_pc_ssh_settings(pc_id)
    if settings is None:
        raise ShutdownUnavailableError("SSH未設定")
    if require_verified:
        if not settings["enabled"]:
            raise ShutdownUnavailableError("シャットダウンは無効です")
        if not settings["verified_at"] or settings["verified_ip"] != ip_address:
            raise ShutdownUnavailableError("SSH接続テストが必要です")
    directory = _get_key_directory(settings)
    identity_file = directory / "identity"
    if not identity_file.is_file():
        raise ShutdownUnavailableError("SSH鍵を作成してください")
    alias = f"wol-pc-{quote(pc_id, safe='')}"
    known_hosts_file = _get_host_key_file(settings)
    if not known_hosts_file.is_file():
        raise ShutdownUnavailableError("PCのホスト鍵を再登録してください")
    return ShutdownSshSettings(ip_address, settings["username"], settings["port"], str(identity_file), str(known_hosts_file), alias, settings["revision"])


def build_windows_key_registration_script(username: str, public_key: str) -> str:
    """対象ユーザーで実行する公開鍵登録コマンドを作る。

    Args:
        username: SSH接続に使うWindowsのローカルユーザー名。
        public_key: ラズパイ側で生成した公開鍵。

    Returns:
        対象ユーザーで実行するPowerShellスクリプト。管理者ユーザーにも対応する。
    """
    # コマンドはPC上で実行する。パスワードや秘密鍵をブラウザへ渡さない。
    key_literal = public_key.replace("'", "''")
    return f'''# SSHに使うユーザー「{username}」のPowerShellで実行してください。
$ErrorActionPreference = 'Stop'
if ($env:USERNAME -ine '{username}') {{ throw 'SSHに使うユーザーで実行してください' }}
$publicKey = '{key_literal}'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
$isAdmin = $identity.Groups.Value -contains 'S-1-5-32-544'
if ($isAdmin -and !$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {{
  throw '同じユーザーでPowerShellを管理者として起動してください'
}}
if ($isAdmin) {{
  $directory = Join-Path $env:ProgramData 'ssh'
  $file = Join-Path $directory 'administrators_authorized_keys'
}} else {{
  $directory = Join-Path $env:USERPROFILE '.ssh'
  $file = Join-Path $directory 'authorized_keys'
}}
New-Item -ItemType Directory -Force -Path $directory | Out-Null
if (!(Test-Path $file)) {{ New-Item -ItemType File -Path $file | Out-Null }}
if (!((Get-Content $file) -contains $publicKey)) {{
  $existing = [IO.File]::ReadAllText($file)
  $separator = if ($existing.Length -gt 0 -and !$existing.EndsWith("`n")) {{ "`r`n" }} else {{ '' }}
  [IO.File]::AppendAllText($file, $separator + $publicKey + "`r`n", [Text.Encoding]::ASCII)
}}
if ($isAdmin) {{
  icacls.exe $file /inheritance:r /grant:r '*S-1-5-32-544:F' '*S-1-5-18:F' | Out-Null
}} else {{
  $sid = $identity.User.Value
  icacls.exe $directory /inheritance:r /grant:r "*$($sid):F" '*S-1-5-18:F' '*S-1-5-32-544:F' | Out-Null
  if ($LASTEXITCODE -ne 0) {{ throw '公開鍵フォルダーの権限設定に失敗しました' }}
  icacls.exe $file /inheritance:r /grant:r "*$($sid):F" '*S-1-5-18:F' '*S-1-5-32-544:F' | Out-Null
}}
if ($LASTEXITCODE -ne 0) {{ throw '公開鍵の権限設定に失敗しました' }}
Write-Output '公開鍵を登録しました。画面でホスト鍵の照合と接続テストを行ってください。'
'''
