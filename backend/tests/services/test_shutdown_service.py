from __future__ import annotations

import base64
import hashlib
import subprocess
from pathlib import Path
from unittest.mock import Mock

import pytest

from app.services import pc_service, shutdown_service, ssh_settings_service


@pytest.fixture
def shutdown_environment(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> tuple[Path, dict[str, str], Mock]:
    """登録済みPCとSSH設定を用意し、通信と停止命令はすべて模擬する。"""
    monkeypatch.setenv("WOL_SSH_KEY_DIR", str(tmp_path))
    directory = tmp_path / ("a" * 32)
    directory.mkdir()
    (directory / "identity").write_text("test-only-placeholder")
    raw_key = b"\x00\x00\x00\x0bssh-ed25519\x00\x00\x00\x20" + bytes(range(32))
    host_key = "ssh-ed25519 " + base64.b64encode(raw_key).decode()
    digest = hashlib.sha256(host_key.encode()).hexdigest()
    (directory / f"known_hosts-{digest}").write_text(f"wol-pc-pc-1 {host_key}\n")
    settings_row = {
        "pc_id": "pc-1", "username": "wol-user", "port": 22, "enabled": 1,
        "key_id": "a" * 32, "host_key": host_key, "revision": 1,
        "verified_ip": "192.168.10.103", "verified_at": "2026-10-01T00:00:00Z",
    }
    monkeypatch.setattr(ssh_settings_service.ssh_settings_repository, "get_pc_ssh_settings", lambda _: settings_row)
    pc_row = {"ip_address": "192.168.10.103", "status": "online"}
    monkeypatch.setattr(shutdown_service.pc_repository, "get_pc_by_id", lambda _: pc_row)
    ssh_process = Mock(return_value=subprocess.CompletedProcess(
        args=[], returncode=0, stdout="wol-dashboard-ssh-ready\n", stderr="",
    ))
    monkeypatch.setattr(shutdown_service.subprocess, "run", ssh_process)
    monkeypatch.setattr(shutdown_service, "insert_log", Mock())
    monkeypatch.setattr(shutdown_service.time, "sleep", lambda _: None)
    return directory, pc_row, ssh_process


def test_uses_registered_ip_and_default_port_without_exposing_settings(shutdown_environment, monkeypatch) -> None:
    """IPの二重設定をなくし、変更後も同じPCのホスト鍵を照合する。"""
    _, pc_row, _ = shutdown_environment
    first = shutdown_service.get_ready_shutdown_connection("pc-1")
    pc_row["ip_address"] = "192.168.10.104"
    updated = ssh_settings_service.load_pc_ssh_connection("pc-1", pc_row["ip_address"], require_verified=False)
    assert first.ip_address == "192.168.10.103"
    assert updated.ip_address == "192.168.10.104" and updated.port == 22
    assert first.host_key_alias == updated.host_key_alias == "wol-pc-pc-1"
    assert shutdown_service.get_shutdown_capability("pc-1", updated.ip_address)["configured"] is False
    with pytest.raises(shutdown_service.ShutdownUnavailableError, match="接続テスト"):
        shutdown_service.get_ready_shutdown_connection("pc-1")


@pytest.mark.parametrize("offline_observed", [True, False])
def test_sends_normal_shutdown_and_reports_communication_result(shutdown_environment, monkeypatch, offline_observed: bool) -> None:
    """強制終了せず、命令送信と通信停止の観測を別々に返す。"""
    _, _, ssh_process = shutdown_environment
    monkeypatch.setattr(pc_service, "refresh_pc_status", lambda _: {"status": "offline" if offline_observed else "online"})
    settings = shutdown_service.get_ready_shutdown_connection("pc-1")
    result = shutdown_service.shutdown_pc_and_check_status("pc-1", settings)
    commands = [call.args[0] for call in ssh_process.call_args_list]
    assert [command[-1] for command in commands] == ["echo wol-dashboard-ssh-ready", "shutdown /s /t 0"]
    assert commands[-1][-2] == settings.ip_address
    assert "StrictHostKeyChecking=yes" in commands[-1]
    assert "HostKeyAlias=wol-pc-pc-1" in commands[-1]
    assert result["command_sent"] is True and result["offline_observed"] is offline_observed
    assert "電源断そのものは未確認" in result["message"] if offline_observed else "通信の停止は確認できません" in result["message"]


@pytest.mark.parametrize("failure", ["connection", "timeout"])
def test_ssh_failure_stops_before_shutdown_and_hides_output(shutdown_environment, failure: str) -> None:
    """SSH失敗時は停止命令を送らず、秘密情報をエラーへ出さない。"""
    _, _, ssh_process = shutdown_environment
    if failure == "timeout":
        ssh_process.side_effect = subprocess.TimeoutExpired("private-key-path", 10)
    else:
        ssh_process.return_value = subprocess.CompletedProcess([], 255, stdout="private-key-path", stderr="secret-user")
    settings = shutdown_service.get_ready_shutdown_connection("pc-1")
    with pytest.raises(shutdown_service.ShutdownUnavailableError) as error:
        shutdown_service.shutdown_pc_and_check_status("pc-1", settings)
    assert "private-key-path" not in str(error.value) and "secret-user" not in str(error.value)
    assert ssh_process.call_count == 1
    assert ssh_process.call_args.args[0][-1] == "echo wol-dashboard-ssh-ready"


@pytest.mark.parametrize("change_after_send", [False, True])
def test_ip_change_during_job_does_not_operate_on_another_pc(shutdown_environment, monkeypatch, change_after_send: bool) -> None:
    """受付後のIP変更を検出し、変更先へ停止命令や監視を行わない。"""
    _, pc_row, ssh_process = shutdown_environment
    settings = shutdown_service.get_ready_shutdown_connection("pc-1")
    refresh_status = Mock()
    monkeypatch.setattr(pc_service, "refresh_pc_status", refresh_status)
    if change_after_send:
        def simulate_ssh(argv: list[str], **kwargs: object) -> subprocess.CompletedProcess:
            if argv[-1] == "shutdown /s /t 0":
                pc_row["ip_address"] = "192.168.10.104"
            return subprocess.CompletedProcess(argv, 0, stdout="wol-dashboard-ssh-ready", stderr="")
        ssh_process.side_effect = simulate_ssh
        result = shutdown_service.shutdown_pc_and_check_status("pc-1", settings)
        assert result["command_sent"] is True and result["offline_observed"] is False
        assert "PC設定が変更" in result["message"]
    else:
        pc_row["ip_address"] = "192.168.10.104"
        with pytest.raises(shutdown_service.ShutdownUnavailableError, match="接続テスト"):
            shutdown_service.shutdown_pc_and_check_status("pc-1", settings)
        ssh_process.assert_not_called()
    refresh_status.assert_not_called()
