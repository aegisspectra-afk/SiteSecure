"""Grant or revoke platform-admin by auth user UUID (operator / deployment only).

G-030: replaces hard-coded email seeding in migration 0036 for *future* bootstrap.
Runtime authorization still uses profiles.is_platform_admin (UUID), never email.

Usage (from apps/api, with repo .env loaded):

  python scripts/bootstrap_platform_admin.py --email someone@example.com
  python scripts/bootstrap_platform_admin.py --user-id <uuid>
  python scripts/bootstrap_platform_admin.py --email someone@example.com --revoke

Optional env (never commit real values):

  PLATFORM_ADMIN_BOOTSTRAP_EMAIL=someone@example.com

Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
Does not run on API startup. Ordinary JWT users cannot invoke grant/revoke RPCs.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import httpx

# Allow `python scripts/bootstrap_platform_admin.py` from apps/api
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import get_settings  # noqa: E402


def _service_headers(key: str) -> dict[str, str]:
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def _resolve_user_id(settings, email: str | None, user_id: str | None) -> str:
    if user_id:
        return user_id.strip()
    if not email:
        raise SystemExit("Provide --email, --user-id, or PLATFORM_ADMIN_BOOTSTRAP_EMAIL")
    key = settings.supabase_service_role_key
    assert key
    with httpx.Client(timeout=30) as client:
        # Prefer profiles (app identity); fall back to Auth Admin API.
        res = client.get(
            f"{settings.supabase_url}/rest/v1/profiles",
            headers=_service_headers(key),
            params={"email": f"eq.{email.strip().lower()}", "select": "id,email,is_platform_admin"},
        )
        if res.status_code == 200 and res.json():
            return str(res.json()[0]["id"])
        # Auth admin list filter
        auth = client.get(
            f"{settings.supabase_url}/auth/v1/admin/users",
            headers=_service_headers(key),
            params={"page": 1, "per_page": 200},
        )
    if auth.status_code != 200:
        raise SystemExit(f"Auth admin lookup failed: {auth.status_code} {auth.text[:200]}")
    target = email.strip().lower()
    for row in (auth.json() or {}).get("users") or []:
        if str(row.get("email") or "").strip().lower() == target:
            return str(row["id"])
    raise SystemExit(f"No auth user / profile found for email {email!r}")


def _rpc(settings, name: str, payload: dict) -> httpx.Response:
    key = settings.supabase_service_role_key
    assert key
    with httpx.Client(timeout=30) as client:
        return client.post(
            f"{settings.supabase_url}/rest/v1/rpc/{name}",
            headers=_service_headers(key),
            json=payload,
        )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", default=None, help="Lookup profile/auth user by email (bootstrap only)")
    parser.add_argument("--user-id", default=None, help="Auth user UUID (preferred)")
    parser.add_argument("--revoke", action="store_true", help="Revoke instead of grant")
    args = parser.parse_args()

    get_settings.cache_clear()
    settings = get_settings()
    if not settings.supabase_service_role_key:
        print("SUPABASE_SERVICE_ROLE_KEY required", file=sys.stderr)
        return 2

    import os

    email = args.email or os.environ.get("PLATFORM_ADMIN_BOOTSTRAP_EMAIL") or None
    user_id = _resolve_user_id(settings, email, args.user_id)
    rpc_name = "revoke_platform_admin" if args.revoke else "grant_platform_admin"
    res = _rpc(settings, rpc_name, {"p_user_id": user_id})
    if res.status_code not in {200, 204}:
        print(f"{rpc_name} failed: {res.status_code} {res.text[:400]}", file=sys.stderr)
        return 1
    action = "revoked" if args.revoke else "granted"
    print(f"platform_admin {action} for user_id={user_id}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
