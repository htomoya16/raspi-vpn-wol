from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api import events, jobs, logs, pcs
from app.db.database import init_db


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="raspi-vpn-wol API", lifespan=lifespan)

app.include_router(logs.router, prefix="/api", tags=["logs"])
app.include_router(pcs.router, prefix="/api", tags=["pcs"])
app.include_router(jobs.router, prefix="/api", tags=["jobs"])
app.include_router(events.router, prefix="/api", tags=["events"])


@app.get(
    "/api/health",
    summary="API 稼働状態を確認する",
    description="アプリの生存確認用エンドポイント。成功時は固定レスポンスを返す。",
    responses={
        200: {
            "description": "稼働確認成功",
            "content": {
                "application/json": {
                    "example": {"status": "ok"},
                }
            },
        }
    },
)
def health() -> dict[str, str]:
    return {"status": "ok"}
