from fastapi import FastAPI

app = FastAPI(title="raspi-vpn-wol API")

@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
