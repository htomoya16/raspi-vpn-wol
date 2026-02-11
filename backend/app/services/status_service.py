from __future__ import annotations

from app.services.log_service import insert_log


def get_status(target: str) -> dict[str, str]:
    status = "unknown"
    message = "status probe is not implemented yet"

    insert_log(
        action="status",
        target=target,
        status=status,
        message=message,
    )

    return {"target": target, "status": status}
