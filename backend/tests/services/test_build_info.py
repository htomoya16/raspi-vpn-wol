from __future__ import annotations

import subprocess
from types import SimpleNamespace

from app import build_info


def test_resolve_git_short_sha_returns_local_when_git_command_not_found(monkeypatch) -> None:
    def _raise_not_found(*_args, **_kwargs):
        raise FileNotFoundError("git not found")

    monkeypatch.setattr(build_info.subprocess, "run", _raise_not_found)
    build_info._resolve_git_short_sha.cache_clear()

    assert build_info._resolve_git_short_sha() == build_info.DEFAULT_APP_BUILD


def test_resolve_git_short_sha_returns_local_when_git_command_times_out(monkeypatch) -> None:
    def _raise_timeout(*_args, **_kwargs):
        raise subprocess.TimeoutExpired(cmd="git", timeout=1.0)

    monkeypatch.setattr(build_info.subprocess, "run", _raise_timeout)
    build_info._resolve_git_short_sha.cache_clear()

    assert build_info._resolve_git_short_sha() == build_info.DEFAULT_APP_BUILD


def test_resolve_git_short_sha_returns_local_on_non_zero_exit(monkeypatch) -> None:
    monkeypatch.setattr(
        build_info.subprocess,
        "run",
        lambda *_args, **_kwargs: SimpleNamespace(returncode=1, stdout="", stderr="failed"),
    )
    build_info._resolve_git_short_sha.cache_clear()

    assert build_info._resolve_git_short_sha() == build_info.DEFAULT_APP_BUILD


def test_resolve_git_short_sha_returns_truncated_sha_on_success(monkeypatch) -> None:
    monkeypatch.setattr(
        build_info.subprocess,
        "run",
        lambda *_args, **_kwargs: SimpleNamespace(returncode=0, stdout="1234567890abcdef\n", stderr=""),
    )
    build_info._resolve_git_short_sha.cache_clear()

    assert build_info._resolve_git_short_sha() == "1234567890ab"
