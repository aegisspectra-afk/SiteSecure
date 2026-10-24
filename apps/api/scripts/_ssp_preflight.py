"""Classify env hosts and live local stack. Does not print secrets."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import urlparse

import httpx

API_ROOT = Path(__file__).resolve().parents[1]
REPO = API_ROOT.parents[1]
sys.path.insert(0, str(API_ROOT))
from tests.ssp_c5_local import classify_supabase_host, parse_env_file

URL_KEYS = {
    "SUPABASE_URL",
    "VITE_SUPABASE_URL",
    "VITE_API_URL",
    "API_PUBLIC_URL",
    "WEB_PUBLIC_URL",
    "SITE_URL",
}


def dump_file(path: Path) -> None:
    print(f"FILE {path.relative_to(REPO) if path.is_relative_to(REPO) else path} exists={path.is_file()}")
    if not path.is_file():
        return
    values = parse_env_file(path)
    for key, raw in values.items():
        key = key.lstrip("\ufeff")
        if key not in URL_KEYS and "URL" not in key:
            continue
        parsed = urlparse(raw.strip().lstrip("\ufeff"))
        host = parsed.hostname or "-"
        print(f"  {key} host={host} port={parsed.port or '-'} class={classify_supabase_host(host if host != '-' else None)}")


def main() -> int:
    os.chdir(API_ROOT)
    for rel in (
        ".env.c5.local",
        ".env",
        "apps/api/.env",
        "apps/web/.env",
        "apps/web/.env.local",
        "apps/web/.env.development",
        "apps/api/.env.c5.local",
    ):
        dump_file(REPO / rel)

    checks = {
        "local_api_54321": "http://127.0.0.1:54321/auth/v1/health",
        "local_studio_54323": "http://127.0.0.1:54323",
        "isolated_fastapi_8001": "http://127.0.0.1:8001/health",
        "isolated_vite_5176": "http://127.0.0.1:5176/login",
        "cloud_fastapi_8000": "http://127.0.0.1:8000/health",
        "cloud_vite_5173": "http://127.0.0.1:5173/login",
    }
    with httpx.Client(timeout=8, follow_redirects=True) as client:
        for name, url in checks.items():
            try:
                res = client.get(url)
                print(f"HTTP {name} status={res.status_code}")
            except Exception as exc:  # noqa: BLE001
                print(f"HTTP {name} error={type(exc).__name__}")

        try:
            transformed = client.get("http://127.0.0.1:5176/src/lib/supabase.ts")
            text = transformed.text
            local = "127.0.0.1:54321" in text or "localhost:54321" in text
            cloud = "supabase.co" in text
            print(f"VITE_TRANSFORM supabase_ts local={local} cloud={cloud} http={transformed.status_code}")
        except Exception as exc:  # noqa: BLE001
            print(f"VITE_TRANSFORM error={type(exc).__name__}")

        try:
            proxied = client.get("http://127.0.0.1:5176/api/v1/health")
            print(f"VITE_PROXY_HEALTH status={proxied.status_code}")
        except Exception as exc:  # noqa: BLE001
            print(f"VITE_PROXY_HEALTH error={type(exc).__name__}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
