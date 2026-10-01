from __future__ import annotations

import json
import base64
import hashlib

import pytest

from app.repositories import job_repository, pc_repository, ssh_settings_repository
from app.services import api_token_service, job_service, pc_service, shutdown_service
from app.security.rate_limit import reset_rate_limiter_for_test
from app.use_cases import shutdown_use_case


def register_test_pc(client, pc_id="pc-1", mac="AA:BB:CC:DD:EE:01", ip="192.168.10.103"):
    """通信を行わず、APIテスト用のPCを登録する。"""
    response = client.post("/api/pcs", json={"id": pc_id, "name": pc_id, "mac": mac, "ip": ip})
    assert response.status_code == 201
    return response.json()["pc"]


def test_unconfigured_offline_missing_and_public_requests_are_rejected(client, monkeypatch):
    pc = register_test_pc(client)
    assert pc["shutdown"] == {"configured": False, "reason": "SSH未設定"}
    assert client.post("/api/pcs/pc-1/shutdown").status_code == 409
    assert client.post("/api/pcs/missing/shutdown").status_code == 404
    client.headers.pop("Authorization")
    assert client.post("/api/pcs/pc-1/shutdown").status_code == 401


@pytest.mark.parametrize("role", ["admin", "device"])
def test_both_roles_can_shutdown_with_rate_limit(client, monkeypatch, role):
    issued = api_token_service.create_token(name="shutdown-role", expires_at=None, role=role)
    client.headers.update({"Authorization": f"Bearer {issued['plain_token']}"})
    calls = []
    async def request(pc_id):
        calls.append(pc_id)
        return {"id": "job-shutdown", "state": "queued"}
    monkeypatch.setattr(shutdown_use_case, "request_pc_shutdown", request)
    for _ in range(3):
        assert client.post("/api/pcs/pc-1/shutdown").status_code == 202
    assert client.post("/api/pcs/pc-1/shutdown").status_code == 429
    assert calls == ["pc-1"] * 3


def test_shutdown_is_not_available_during_bootstrap(client, monkeypatch):
    monkeypatch.setattr(api_token_service, "has_active_tokens", lambda: False)
    client.headers.pop("Authorization")
    assert client.post("/api/pcs/pc-1/shutdown").status_code == 401


def test_jobs_are_deduplicated_per_pc_and_settings_are_not_exposed(client, monkeypatch, tmp_path):
    register_test_pc(client)
    register_test_pc(client, "pc-2", "AA:BB:CC:DD:EE:02", "192.168.10.104")
    monkeypatch.setenv("WOL_SSH_KEY_DIR", str(tmp_path))
    host_key = "ssh-ed25519 " + base64.b64encode(
        b"\x00\x00\x00\x0bssh-ed25519\x00\x00\x00\x20" + bytes(range(32))
    ).decode()
    for pc_id, ip in (("pc-1", "192.168.10.103"), ("pc-2", "192.168.10.104")):
        settings = ssh_settings_repository.save_pc_ssh_settings(pc_id, "wol-user", 22, True)
        directory = tmp_path / settings["key_id"]
        directory.mkdir()
        (directory / "identity").write_text("test-only-private-key")
        hosts = directory / ("known_hosts-" + hashlib.sha256(host_key.encode()).hexdigest())
        hosts.write_text(f"wol-pc-{pc_id} {host_key}\n")
        assert ssh_settings_repository.save_confirmed_host_key(pc_id, host_key, ip, settings["revision"])
        assert ssh_settings_repository.record_ssh_verification(pc_id, ip, settings["revision"] + 1, True)
    assert client.post("/api/pcs/pc-1/shutdown").status_code == 409  # 起動状態はまだ未確認。
    for pc_id in ("pc-1", "pc-2"):
        pc_repository.update_pc_status(pc_id, "online")
    pc_service.cache.clear()
    started = []
    async def run_job(job_id, runner):
        started.append(job_id)  # 停止処理は実行せず、ジョブ受付だけを確認する。
        job_repository.mark_running(job_id)
    monkeypatch.setattr(job_service, "run_job", run_job)
    # 先ほどの拒否で消費した回数をリセットし、重複要求を検証する。
    reset_rate_limiter_for_test()
    first = client.post("/api/pcs/pc-1/shutdown").json()["job_id"]
    duplicate = client.post("/api/pcs/pc-1/shutdown").json()["job_id"]
    other = client.post("/api/pcs/pc-2/shutdown").json()["job_id"]
    assert first == duplicate and first != other
    assert len(started) == 2
    job = client.get(f"/api/jobs/{first}").json()["job"]
    assert job["type"] == "shutdown" and job["payload"] == {"pc_id": "pc-1"}
    pc = client.get("/api/pcs/pc-1").json()["pc"]
    assert pc["shutdown"] == {"configured": True, "reason": None}
    assert str(tmp_path) not in json.dumps(pc) + json.dumps(job)
    # IPはPC情報を使うが、変更後の接続確認が済むまで停止操作を許可しない。
    client.patch("/api/pcs/pc-1", json={"ip": "192.168.10.105"})
    with pytest.raises(shutdown_service.ShutdownUnavailableError, match="接続テスト"):
        shutdown_service.get_ready_shutdown_connection("pc-1")
