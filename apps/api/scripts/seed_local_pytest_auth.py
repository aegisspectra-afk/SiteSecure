"""Seed confirmed local Auth users for pytest live suites (loopback only).

Run after every ``supabase db reset`` so Phase-3 fixtures can password-grant
without per-test admin provisioning::

  supabase db reset
  python apps/api/scripts/seed_local_pytest_auth.py

Uses GoTrue admin API + ``SUPABASE_SERVICE_ROLE_KEY`` from ``apps/api/.env``.
Keys may also be taken from ``supabase status -o env`` when env vars are empty.

Does not create workspaces — live tests call ``create_workspace`` / API as needed.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import quote, urlparse

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[3]
load_dotenv(ROOT / ".env")
load_dotenv(ROOT / "apps" / "api" / ".env")

PASSWORD = "Test-Pass-2026!"

# emails used across test_tenant_isolation, workspace invitations, entitlements, etc.
LOCAL_PYTEST_USERS: list[tuple[str, str | None]] = [
    ("ss.phase3.a@sitesecure.test", None),
    ("ss.phase3.b@sitesecure.test", None),
    # Stable UUIDs — test_tenant_isolation._ensure_member inserts by user_id
    ("ss.phase3.viewer@sitesecure.test", "b3ff2e4c-0c7a-41f7-9264-70c8784909c2"),
    ("ss.phase3.tech@sitesecure.test", "0242ad20-9a63-4b92-b571-be46cbc9c391"),
]


def _die(msg: str) -> None:
    print(msg, file=sys.stderr)
    raise SystemExit(2)


def _assert_loopback(url: str) -> None:
    host = (urlparse(url).hostname or "").lower()
    if host not in {"127.0.0.1", "localhost"}:
        _die(f"Refusing non-local SUPABASE_URL host={host!r}")


def _status_env() -> dict[str, str]:
    try:
        proc = subprocess.run(
            ["supabase", "status", "-o", "env"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=60,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return {}
    if proc.returncode != 0:
        return {}
    out: dict[str, str] = {}
    for line in proc.stdout.splitlines():
        line = line.strip()
        if not line.startswith("export "):
            continue
        body = line.removeprefix("export ").strip()
        if "=" not in body:
            continue
        key, _, val = body.partition("=")
        out[key] = val.strip().strip('"').strip("'")
    return out


def _resolve_config() -> tuple[str, str]:
    status = _status_env()
    url = (os.environ.get("SUPABASE_URL") or status.get("API_URL") or "").rstrip("/")
    service = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or status.get("SERVICE_ROLE_KEY") or ""
    if not url:
        _die("SUPABASE_URL missing — start local Supabase or set apps/api/.env")
    if not service:
        _die("SUPABASE_SERVICE_ROLE_KEY missing — use demo key from supabase status")
    _assert_loopback(url)
    return url, service


def _svc_headers(service: str) -> dict[str, str]:
    return {
        "apikey": service,
        "Authorization": f"Bearer {service}",
        "Content-Type": "application/json",
    }


def _find_user_id(client: httpx.Client, base: str, headers: dict[str, str], email: str) -> str | None:
    filt = quote(f"email.eq.{email}", safe="")
    res = client.get(
        f"{base}/auth/v1/admin/users",
        headers=headers,
        params={"filter": filt, "per_page": "5"},
    )
    if res.status_code != 200:
        return None
    users = (res.json() or {}).get("users") or []
    for row in users:
        if (row.get("email") or "").lower() == email.lower():
            uid = row.get("id")
            if uid:
                return str(uid)
    return None


def _patch_user(
    client: httpx.Client,
    base: str,
    headers: dict[str, str],
    user_id: str,
    email: str,
    password: str,
) -> None:
    res = client.put(
        f"{base}/auth/v1/admin/users/{user_id}",
        headers=headers,
        json={
            "email": email,
            "password": password,
            "email_confirm": True,
        },
    )
    if res.status_code not in {200, 201}:
        _die(f"admin update failed for {email}: {res.status_code} {res.text[:200]}")


def _ensure_user(
    client: httpx.Client,
    base: str,
    headers: dict[str, str],
    email: str,
    password: str,
    user_id: str | None,
) -> str:
    body: dict[str, object] = {
        "email": email,
        "password": password,
        "email_confirm": True,
    }
    if user_id:
        body["id"] = user_id
    res = client.post(f"{base}/auth/v1/admin/users", headers=headers, json=body)
    if res.status_code in {200, 201}:
        uid = str((res.json() or {}).get("id") or "")
        if uid:
            return uid
        _die(f"admin create returned no id for {email}")
    if res.status_code == 422:
        existing = _find_user_id(client, base, headers, email)
        if not existing:
            _die(f"user exists but not found by email {email}")
        if user_id and existing != user_id:
            _die(
                f"{email} exists as {existing} but tests expect {user_id} — "
                "run supabase db reset then re-seed"
            )
        _patch_user(client, base, headers, existing, email, password)
        return existing
    _die(f"admin create failed for {email}: {res.status_code} {res.text[:200]}")


def _verify_password_grant(base: str, anon: str, email: str, password: str) -> None:
    if not anon:
        return
    res = httpx.post(
        f"{base}/auth/v1/token?grant_type=password",
        headers={"apikey": anon, "Content-Type": "application/json"},
        json={"email": email, "password": password},
        timeout=30,
    )
    if res.status_code != 200:
        _die(f"password grant check failed for {email}: {res.status_code} {res.text[:200]}")


def main() -> None:
    base, service = _resolve_config()
    anon = os.environ.get("SUPABASE_ANON_KEY") or _status_env().get("ANON_KEY") or ""
    headers = _svc_headers(service)
    created: list[dict[str, str]] = []
    with httpx.Client(timeout=60) as client:
        for email, fixed_id in LOCAL_PYTEST_USERS:
            uid = _ensure_user(client, base, headers, email, PASSWORD, fixed_id)
            _verify_password_grant(base, anon, email, PASSWORD)
            created.append({"email": email, "id": uid})
    print(json.dumps({"ok": True, "users": created}, indent=2))


if __name__ == "__main__":
    main()