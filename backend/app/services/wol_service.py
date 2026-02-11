from __future__ import annotations

from app.services.log_service import insert_log


def send_wol(target: str) -> dict[str, str]:
    target = target.strip()
    if not target:
        raise ValueError("target is required")

    message = f"WOL request accepted for target={target}"

    insert_log(
        action="wol",
        target=target,
        status="accepted",
        message=message,
    )

    return {"message": message}
