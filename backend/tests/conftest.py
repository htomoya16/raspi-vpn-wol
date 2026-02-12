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


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    test_db_path = tmp_path / "app-test.db"
    monkeypatch.setattr(db_module, "DB_PATH", test_db_path)

    with TestClient(app) as test_client:
        yield test_client
