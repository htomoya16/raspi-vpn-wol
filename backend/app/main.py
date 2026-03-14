import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import Depends, FastAPI, Request
from starlette.responses import Response

from app.api import admin_tokens, auth, events, jobs, logs, pcs
from app.build_info import get_build_info
from app.db.database import init_db
from app.security import require_admin_token, require_bearer_token, reset_current_api_actor, set_current_api_actor
from app.services import status_monitor_service


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    monitor_task = asyncio.create_task(status_monitor_service.run_periodic_status_monitor())
    try:
        yield
    finally:
        monitor_task.cancel()
        with suppress(asyncio.CancelledError):
            await monitor_task


app = FastAPI(title="raspi-vpn-wol API", lifespan=lifespan)


@app.middleware("http")
async def reset_api_actor_context_for_each_request(request: Request, call_next) -> Response:
    token = set_current_api_actor(None)
    try:
        return await call_next(request)
    finally:
        reset_current_api_actor(token)


admin_guard_dependencies = [Depends(require_admin_token)]
guard_dependencies = [Depends(require_bearer_token)]
app.include_router(admin_tokens.router, prefix="/api", tags=["admin"], dependencies=admin_guard_dependencies)
app.include_router(auth.router, prefix="/api", tags=["auth"], dependencies=guard_dependencies)
app.include_router(logs.router, prefix="/api", tags=["logs"], dependencies=guard_dependencies)
app.include_router(pcs.router, prefix="/api", tags=["pcs"], dependencies=guard_dependencies)
app.include_router(jobs.router, prefix="/api", tags=["jobs"], dependencies=guard_dependencies)
app.include_router(events.router, prefix="/api", tags=["events"], dependencies=guard_dependencies)


@app.get(
    "/api/health",
    summary="API 稼働状態を確認する",
    description="アプリの生存確認用エンドポイント。成功時は固定レスポンスを返す。",
    responses={
        200: {
            "description": "稼働確認成功",
            "content": {
                "application/json": {
                    "example": {"status": "ok", "version": "dev", "build": "abc123def456"},
                }
            },
        }
    },
)
def health() -> dict[str, str]:
    build_info = get_build_info()
    return {"status": "ok", "version": build_info["version"], "build": build_info["build"]}
