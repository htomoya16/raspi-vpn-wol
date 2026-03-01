from __future__ import annotations

from pathlib import Path
import sys

import pytest
from fastapi.testclient import TestClient

# Allow `pytest` execution from both repository root and `backend/`.
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.db import database as db_module
from app.main import app
from app.services import api_token_service


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    test_db_path = tmp_path / "app-test.db"
    monkeypatch.setattr(db_module, "DB_PATH", test_db_path)

    with TestClient(app) as test_client:
        created = api_token_service.create_token(name="pytest-default-client", expires_at=None)
        test_client.headers.update({"Authorization": f"Bearer {created['plain_token']}"})
        yield test_client


@pytest.fixture
def client_without_auth_header(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    test_db_path = tmp_path / "app-test.db"
    monkeypatch.setattr(db_module, "DB_PATH", test_db_path)

    with TestClient(app) as test_client:
        api_token_service.create_token(name="pytest-auth-enforced", expires_at=None)
        yield test_client
