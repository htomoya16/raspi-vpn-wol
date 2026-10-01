from __future__ import annotations

import subprocess
import time

from app.cache import cache
from app.cache import keys as cache_keys
from app.repositories import pc_repository, ssh_settings_repository
from app.services.log_service import insert_log
from app.services.ssh_settings_service import (
    ShutdownSshSettings, ShutdownUnavailableError, get_registered_pc, load_pc_ssh_connection,
)

MONITOR_ATTEMPTS = 15
MONITOR_INTERVAL_SECONDS = 3
SSH_CHECK_COMMAND = "echo wol-dashboard-ssh-ready"
WINDOWS_SHUTDOWN_COMMAND = "shutdown /s /t 0"


def get_shutdown_capability(pc_id: str, ip_address: str) -> dict[str, object]:
    """画面向けに、SSH設定の有無と操作できない理由を返す。

    Args:
        pc_id: 登録済みPCのID。
        ip_address: PC情報に登録されているIPv4アドレス。

    Returns:
        configuredとreasonを含む情報。ユーザー名や鍵のパスは含めない。
    """
    try:
        load_pc_ssh_connection(pc_id, ip_address)
    except ShutdownUnavailableError as exc:
        return {"configured": False, "reason": str(exc)}
    except OSError:
        return {"configured": False, "reason": "SSH鍵の保存先と権限を確認してください"}
    return {"configured": True, "reason": None}


def get_ready_shutdown_connection(pc_id: str) -> ShutdownSshSettings:
    """登録情報と現在の状態から、停止操作に使える接続情報を取得する。

    Args:
        pc_id: 停止対象のPC ID。

    Returns:
        オンラインの対象PCに対応するSSH接続情報。

    Raises:
        LookupError: 対象PCが存在しない場合。
        ShutdownUnavailableError: SSH設定が不正、またはPCがオンラインでない場合。
    """
    row = get_registered_pc(pc_id)
    settings = load_pc_ssh_connection(pc_id, row["ip_address"])
    if row["status"] != "online":
        raise ShutdownUnavailableError("オンラインのPCのみシャットダウンできます")
    return settings


def verify_pc_ssh_connection(pc_id: str) -> dict[str, object]:
    """停止命令を送らずに接続し、成功した設定とIPを記録する。

    Args:
        pc_id: 接続確認するPCのID。

    Returns:
        接続確認後の画面向けSSH設定。

    Raises:
        ShutdownUnavailableError: 接続失敗、または確認中に設定が変更された場合。
    """
    from app.services import pc_registry_service, ssh_settings_service

    pc = get_registered_pc(pc_id)
    settings = load_pc_ssh_connection(pc_id, pc["ip_address"], require_verified=False)
    try:
        if _execute_ssh_command(settings, SSH_CHECK_COMMAND) != "wol-dashboard-ssh-ready":
            raise ShutdownUnavailableError("SSH接続の確認に失敗しました")
        if not ssh_settings_repository.record_ssh_verification(pc_id, settings.ip_address, settings.revision, True):
            raise ShutdownUnavailableError("確認中にPCまたはSSH設定が変更されました。再度接続テストしてください")
        pc_registry_service.update_runtime_status(pc_id, "online", mark_seen=True)
        insert_log("ssh_setup", pc_id, "ok", message="SSH接続テストに成功しました（停止命令は未送信）")
    except ShutdownUnavailableError:
        ssh_settings_repository.record_ssh_verification(pc_id, settings.ip_address, settings.revision, False)
        insert_log("ssh_setup", pc_id, "failed", message="SSH接続テストに失敗しました")
        raise
    finally:
        cache.invalidate_prefix(cache_keys.PCS_LIST_PREFIX)
    return ssh_settings_service.get_ssh_settings(pc_id)


def _execute_ssh_command(settings: ShutdownSshSettings, command: str) -> str:
    """指定したPCへ、アプリで決めた固定コマンドをSSHで送る。

    Args:
        settings: 検証済みのSSH接続情報。
        command: 接続確認またはWindows停止用の固定コマンド。

    Returns:
        前後の空白を取り除いた標準出力。

    Raises:
        ShutdownUnavailableError: SSHを実行できない、失敗する、または時間切れの場合。
    """
    # 外部のssh_configや対話入力を使わず、事前登録したPC別のホスト鍵を照合する。
    argv = [
        "ssh", "-F", "/dev/null", "-T", "-n",
        "-o", "BatchMode=yes", "-o", "IdentitiesOnly=yes",
        "-o", "StrictHostKeyChecking=yes", "-o", "GlobalKnownHostsFile=/dev/null",
        "-o", f'UserKnownHostsFile="{settings.known_hosts_file}"',
        "-o", f"HostKeyAlias={settings.host_key_alias}",
        "-o", "ConnectTimeout=5", "-o", "ConnectionAttempts=1",
        "-o", "ServerAliveInterval=3", "-o", "ServerAliveCountMax=1",
        "-i", settings.identity_file, "-p", str(settings.port),
        "-l", settings.username, settings.ip_address, command,
    ]
    try:
        result = subprocess.run(argv, capture_output=True, text=True, timeout=10, check=False)
    except FileNotFoundError as exc:
        raise ShutdownUnavailableError("ラズパイ側にSSHクライアントがありません") from exc
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise ShutdownUnavailableError(
            "SSH処理の完了を確認できませんでした。接続設定とPCの状態を確認してください"
        ) from exc
    if result.returncode != 0:
        # SSHの出力にはユーザー名や鍵パスが含まれ得るため、公開エラーへ転記しない。
        if command == WINDOWS_SHUTDOWN_COMMAND:
            raise ShutdownUnavailableError(
                "停止指示の成否を確認できませんでした。"
                "再操作の前にPCの状態・SSH設定・停止権限を確認してください"
            )
        raise ShutdownUnavailableError(
            "SSH処理が失敗しました。接続設定・ホスト鍵・停止権限を確認してください"
        )
    return result.stdout.strip()


def _wait_for_pc_offline(pc_id: str, ip_address: str) -> tuple[bool, str]:
    """停止指示の送信後、同じPCへの通信が途絶えるかを確認する。

    Args:
        pc_id: 停止指示を送信したPC ID。
        ip_address: 指示送信時の接続先IP。

    Returns:
        通信停止を観測できたかどうかと、画面に表示する結果メッセージ。
    """
    # PC一覧でもSSH設定を参照するため、循環インポートを避けて実行時に読み込む。
    from app.services import pc_service

    offline_streak = 0
    for attempt in range(MONITOR_ATTEMPTS):
        row = pc_repository.get_pc_by_id(pc_id)
        if row is None or row["ip_address"] != ip_address:
            return False, "停止指示は送信済みですが、PC設定が変更されたため通信の停止は未確認です"
        observed = pc_service.refresh_pc_status(pc_id)
        offline_streak = offline_streak + 1 if observed["status"] == "offline" else 0
        if offline_streak >= 2:
            return True, "停止指示送信後、PCへの通信が途絶えました（電源断そのものは未確認）"
        if attempt + 1 < MONITOR_ATTEMPTS:
            time.sleep(MONITOR_INTERVAL_SECONDS)
    return False, "停止指示は送信済みですが、通信の停止は確認できませんでした。未保存の作業などを確認してください"


def shutdown_pc_and_check_status(
    pc_id: str, expected_settings: ShutdownSshSettings,
) -> dict[str, object]:
    """Windowsへ通常の停止指示を送り、その後の通信状態を記録する。

    Args:
        pc_id: 停止対象のPC ID。
        expected_settings: ジョブ受付時の接続情報。実行直前の設定変更を検出する。

    Returns:
        指示の送信結果、通信停止の観測結果、結果メッセージを含む情報。

    Raises:
        ShutdownUnavailableError: 設定変更、接続失敗、または処理結果が不明な場合。
    """
    try:
        settings = get_ready_shutdown_connection(pc_id)
        if settings != expected_settings:
            raise ShutdownUnavailableError("PCまたはSSH設定が変更されました。再確認してください")
        # 直前の疎通確認はSSHで行い、別ポートへの重複した確認は行わない。
        if _execute_ssh_command(settings, SSH_CHECK_COMMAND) != "wol-dashboard-ssh-ready":
            raise ShutdownUnavailableError("SSH接続の確認に失敗しました")
        if get_ready_shutdown_connection(pc_id) != expected_settings:
            raise ShutdownUnavailableError("PCまたはSSH設定が変更されました。再確認してください")

        # Windowsでは正の待機時間が強制終了を伴うため、/t 0とし、/fは付けない。
        _execute_ssh_command(settings, WINDOWS_SHUTDOWN_COMMAND)
        insert_log("shutdown", pc_id, "sent", message="シャットダウン指示を送信しました（強制終了なし）")
        offline_observed, message = _wait_for_pc_offline(pc_id, settings.ip_address)
        insert_log("shutdown", pc_id, "ok", message=message)
        return {
            "pc_id": pc_id, "command_sent": True,
            "offline_observed": offline_observed, "message": message,
        }
    except Exception as exc:
        message = (
            str(exc) if isinstance(exc, ShutdownUnavailableError)
            else "シャットダウン処理の状態を確認できませんでした"
        )
        insert_log("shutdown", pc_id, "failed", message=message)
        raise ShutdownUnavailableError(message) from exc
