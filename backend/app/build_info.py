from __future__ import annotations

import os
import subprocess
from functools import lru_cache
from pathlib import Path

DEFAULT_APP_VERSION = "dev"
DEFAULT_APP_BUILD = "local"
GIT_SHA_LENGTH = 12


def _normalize_value(value: str) -> str:
    normalized = value.strip()
    return normalized if normalized else ""


def _short_build(value: str) -> str:
    normalized = _normalize_value(value)
    if not normalized:
        return DEFAULT_APP_BUILD
    if len(normalized) > GIT_SHA_LENGTH:
        return normalized[:GIT_SHA_LENGTH]
    return normalized


@lru_cache(maxsize=1)
def _resolve_git_short_sha() -> str:
    backend_root = Path(__file__).resolve().parents[1]
    try:
        result = subprocess.run(
            ["git", "rev-parse", f"--short={GIT_SHA_LENGTH}", "HEAD"],
            cwd=backend_root,
            capture_output=True,
            text=True,
            check=False,
            timeout=1.0,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return DEFAULT_APP_BUILD
    if result.returncode != 0:
        return DEFAULT_APP_BUILD
    return _short_build(result.stdout)


def get_build_info() -> dict[str, str]:
    app_version = _normalize_value(os.getenv("APP_VERSION", DEFAULT_APP_VERSION)) or DEFAULT_APP_VERSION
    app_build_env = _normalize_value(os.getenv("APP_BUILD", ""))
    app_build = _short_build(app_build_env) if app_build_env else _resolve_git_short_sha()
    return {
        "version": app_version,
        "build": app_build,
    }
