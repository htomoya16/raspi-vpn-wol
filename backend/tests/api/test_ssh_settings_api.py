from __future__ import annotations

import base64
import json
import stat
import subprocess
from unittest.mock import Mock

import pytest

from app.repositories import ssh_settings_repository
from app.services import api_token_service, shutdown_service, ssh_settings_service


@pytest.fixture
def ssh_setup(client, monkeypatch, tmp_path):
    """一時DBと鍵保存先を使い、SSH通信だけを模擬する。"""
    monkeypatch.setenv("WOL_SSH_KEY_DIR", str(tmp_path / "keys"))
    response = client.post("/api/pcs", json={
        "id": "pc-1", "name": "Main PC", "mac": "AA:BB:CC:DD:EE:01", "ip": "192.168.10.103",
    })
    assert response.status_code == 201
    path = "/api/pcs/pc-1/ssh"
    assert client.put(path, json={"username": "wol-user", "enabled": True}).status_code == 200
    # ssh-keygenは実際に実行する。ネットワークと停止命令は使用しない。
    generated = client.post(path + "/key")
    assert generated.status_code == 200
    raw = b"\x00\x00\x00\x0bssh-ed25519\x00\x00\x00\x20" + bytes(range(32))
    host_key = "ssh-ed25519 " + base64.b64encode(raw).decode()
    calls = []

    def simulate_ssh(argv, **kwargs):
        calls.append(argv)
        if argv[0] == "ssh-keyscan":
            return subprocess.CompletedProcess(argv, 0, stdout=f"192.168.10.103 {host_key}\n", stderr="")
        assert argv[0] == "ssh" and argv[-1] == "echo wol-dashboard-ssh-ready"
        return subprocess.CompletedProcess(argv, 0, stdout="wol-dashboard-ssh-ready\n", stderr="")

    monkeypatch.setattr(ssh_settings_service.subprocess, "run", simulate_ssh)
    return client, path, tmp_path / "keys", generated.json(), calls


def confirm_and_test(client, path):
    """ホスト鍵を確認し、停止命令なしの接続テストを完了する。"""
    candidate = client.post(path + "/host-key/scan").json()
    confirmed = client.post(path + "/host-key", json=candidate)
    assert confirmed.status_code == 200
    tested = client.post(path + "/test")
    assert tested.status_code == 200
    return tested.json()


def test_admin_setup_keeps_keys_and_requires_verified_host_and_connection(ssh_setup):
    """設定から有効化、IP変更後の再確認までの一連の操作を確認する。"""
    client, path, root, generated, calls = ssh_setup
    directory = root / ssh_settings_repository.get_pc_ssh_settings("pc-1")["key_id"]
    private_key = (directory / "identity").read_text()
    assert "OPENSSH PRIVATE KEY" in private_key
    assert stat.S_IMODE((directory / "identity").stat().st_mode) == 0o600
    assert stat.S_IMODE(directory.stat().st_mode) == 0o700
    assert client.post(path + "/key").json()["public_key"] == generated["public_key"]
    assert not calls  # 同じ鍵を返すだけで、再生成や通信は行わない。
    assert private_key not in json.dumps(generated) and str(root) not in json.dumps(generated)
    assert "administrators_authorized_keys" in generated["setup_script"]
    assert generated["public_key"] in generated["setup_script"]
    assert not generated["verified"]
    assert client.post(path + "/test").status_code == 409
    candidate = client.post(path + "/host-key/scan").json()
    assert client.get(path).json()["host_fingerprint"] is None
    mismatch = {**candidate, "fingerprint": "SHA256:wrong"}
    assert client.post(path + "/host-key", json=mismatch).status_code == 409
    assert client.post(path + "/host-key", json=candidate).status_code == 200
    assert not client.get("/api/pcs/pc-1").json()["pc"]["shutdown"]["configured"]
    assert client.post(path + "/test").json()["verified"]
    assert client.get("/api/pcs/pc-1").json()["pc"]["shutdown"]["configured"]
    assert client.get("/api/pcs/pc-1").json()["pc"]["status"] == "online"
    for enabled in (False, True):
        saved = client.put(path, json={"username": "wol-user", "enabled": enabled}).json()
        assert saved["verified"] and saved["public_key"] == generated["public_key"]
        assert client.get("/api/pcs/pc-1").json()["pc"]["shutdown"]["configured"] is enabled
    assert client.patch("/api/pcs/pc-1", json={"ip": "192.168.10.104"}).status_code == 200
    assert not client.get(path).json()["verified"]
    assert not client.get("/api/pcs/pc-1").json()["pc"]["shutdown"]["configured"]
    assert client.patch("/api/pcs/pc-1", json={"ip": "192.168.10.103"}).status_code == 200
    assert not client.get(path).json()["verified"]
    assert client.patch("/api/pcs/pc-1", json={"ip": "192.168.10.104"}).status_code == 200
    assert client.post(path + "/test").json()["verified"]
    assert calls[-1][-2] == "192.168.10.104"
    changed = client.put(path, json={"username": "other-user", "port": 2222, "enabled": True}).json()
    assert not changed["verified"] and changed["host_fingerprint"] is None
    assert changed["public_key"] == generated["public_key"]
    assert (directory / "identity").read_text() == private_key
    assert client.get(path).headers["Cache-Control"] == "no-store"


def test_stale_confirmation_and_failed_or_changed_connection_never_enable_shutdown(ssh_setup, monkeypatch):
    """古い設定の確認結果と、失敗した接続を停止可能な状態にしない。"""
    client, path, _, _, _ = ssh_setup
    candidate = client.post(path + "/host-key/scan").json()
    client.put(path, json={"username": "wol-user", "port": 2222, "enabled": True})
    assert client.post(path + "/host-key", json=candidate).status_code == 409
    assert confirm_and_test(client, path)["verified"]
    failed = Mock(return_value=subprocess.CompletedProcess([], 255, stdout="", stderr="secret-path"))
    monkeypatch.setattr(shutdown_service.subprocess, "run", failed)
    failure = client.post(path + "/test")
    assert failure.status_code == 409 and "secret-path" not in failure.text
    assert not client.get(path).json()["verified"]
    assert not client.get("/api/pcs/pc-1").json()["pc"]["shutdown"]["configured"]

    def change_settings_during_probe(argv, **kwargs):
        ssh_settings_repository.save_pc_ssh_settings("pc-1", "other-user", 2222, True)
        return subprocess.CompletedProcess(argv, 0, stdout="wol-dashboard-ssh-ready\n", stderr="")

    monkeypatch.setattr(shutdown_service.subprocess, "run", change_settings_during_probe)
    assert client.post(path + "/test").status_code == 409
    assert not client.get(path).json()["verified"]


def test_ssh_management_requires_admin_even_during_bootstrap(ssh_setup, monkeypatch):
    """一般トークンや認証省略状態から鍵を管理できないことを確認する。"""
    client, path, _, _, calls = ssh_setup
    device = api_token_service.create_token(name="device-test", expires_at=None, role="device")
    client.headers["Authorization"] = f"Bearer {device['plain_token']}"
    requests = [("GET", path, None), ("PUT", path, {"username": "other-user"}),
                ("POST", path + "/key", None), ("POST", path + "/host-key/scan", None),
                ("POST", path + "/host-key", {}), ("POST", path + "/test", None)]
    for method, url, payload in requests:
        assert client.request(method, url, json=payload).status_code == 403
    client.headers.pop("Authorization")
    for method, url, payload in requests:
        assert client.request(method, url, json=payload).status_code == 401
    monkeypatch.setattr(api_token_service, "has_active_tokens", lambda: False)
    for method, url, payload in requests:
        assert client.request(method, url, json=payload).status_code == 401
    assert not calls


def test_deleted_pc_settings_are_removed_without_reusing_its_key(ssh_setup):
    """PCを削除すると設定を消し、再登録したPCへ古い鍵を引き継がない。"""
    client, path, root, generated, _ = ssh_setup
    key_id = ssh_settings_repository.get_pc_ssh_settings("pc-1")["key_id"]
    assert client.delete("/api/pcs/pc-1").status_code == 204
    assert ssh_settings_repository.get_pc_ssh_settings("pc-1") is None
    assert (root / key_id / "identity").is_file()
    assert client.post("/api/pcs", json={
        "id": "pc-1", "name": "New PC", "mac": "AA:BB:CC:DD:EE:01", "ip": "192.168.10.103",
    }).status_code == 201
    assert client.put(path, json={"username": "wol-user"}).status_code == 200
    assert ssh_settings_repository.get_pc_ssh_settings("pc-1")["key_id"] != key_id
    assert client.get(path).json()["public_key"] is None
    assert generated["public_key"] not in client.get(path).text
