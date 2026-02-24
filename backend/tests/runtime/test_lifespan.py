from __future__ import annotations

import asyncio

import app.main as app_main


def test_lifespan_starts_and_cancels_status_monitor(monkeypatch) -> None:
    state = {
        "init_called": False,
        "monitor_started": False,
        "monitor_cancelled": False,
    }

    def _fake_init_db() -> None:
        state["init_called"] = True

    async def _fake_monitor() -> None:
        state["monitor_started"] = True
        try:
            await asyncio.Future()
        except asyncio.CancelledError:
            state["monitor_cancelled"] = True
            raise

    monkeypatch.setattr(app_main, "init_db", _fake_init_db)
    monkeypatch.setattr(app_main.status_monitor_service, "run_periodic_status_monitor", _fake_monitor)

    async def _run_case() -> None:
        async with app_main.lifespan(app_main.app):
            await asyncio.sleep(0)

    asyncio.run(_run_case())

    assert state["init_called"] is True
    assert state["monitor_started"] is True
    assert state["monitor_cancelled"] is True
