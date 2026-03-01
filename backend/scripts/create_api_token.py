from __future__ import annotations

import argparse
from pathlib import Path
import sys

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.db.database import run_migrations  # noqa: E402
from app.services import api_token_service  # noqa: E402


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create API bearer token for raspi-vpn-wol.")
    parser.add_argument("--name", required=True, help="Token display name (device/admin label).")
    parser.add_argument(
        "--role",
        choices=["admin", "device"],
        default="admin",
        help="Token role (default: admin).",
    )
    parser.add_argument(
        "--expires-at",
        default=None,
        help="Optional expiration datetime in ISO-8601 with timezone.",
    )
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    try:
        run_migrations("head")
        created = api_token_service.create_token(
            name=args.name,
            expires_at=args.expires_at,
            role=args.role,
        )
    except Exception as exc:  # pragma: no cover - CLI error path
        print(f"error: {exc}", file=sys.stderr)
        return 1

    token = created["token"]
    plain_token = created["plain_token"]
    print(f"id={token['id']}")
    print(f"name={token['name']}")
    print(f"role={token['role']}")
    print(f"token_prefix={token['token_prefix']}")
    print(f"expires_at={token['expires_at']}")
    print(f"plain_token={plain_token}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
