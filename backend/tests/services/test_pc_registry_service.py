from __future__ import annotations

import pytest

from app.services import pc_registry_service


def test_pc_registry_validation_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(pc_registry_service.pc_repository, "get_pc_by_id", lambda _: None)

    with pytest.raises(ValueError, match="status_method must be 'tcp' or 'ping'"):
        pc_registry_service.upsert_pc("pc-a", "A", "AA:BB:CC:DD:EE:01", status_method="icmp")

    with pytest.raises(ValueError, match="wg interfaces are not allowed for WOL"):
        pc_registry_service.upsert_pc("pc-a", "A", "AA:BB:CC:DD:EE:01", send_interface="wg0")

    with pytest.raises(ValueError, match="status must be one of"):
        pc_registry_service.upsert_pc("pc-a", "A", "AA:BB:CC:DD:EE:01", status="broken")
