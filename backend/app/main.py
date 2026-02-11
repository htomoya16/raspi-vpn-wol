from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api import logs, status, targets, wol
from app.db.database import init_db


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="raspi-vpn-wol API", lifespan=lifespan)

app.include_router(wol.router, prefix="/api", tags=["wol"])
app.include_router(status.router, prefix="/api", tags=["status"])
app.include_router(logs.router, prefix="/api", tags=["logs"])
app.include_router(targets.router, prefix="/api", tags=["targets"])


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
