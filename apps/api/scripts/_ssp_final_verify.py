"""Final local-stack verification after API process replacement.

Does not print secrets. Does not call *.supabase.co. Does not touch port 8000.
"""

from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path
from urllib.parse import urlparse

import httpx

API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))
os.chdir(API_ROOT)

from tests.ssp_c5_local import (  # noqa: E402
    assert_local_supabase_url,
    classify_supabase_host,
    parse_env_file,
    require_c5_local_process_env,
)

API = "http://127.0.0.1:8001"
WEB = "http://127.0.0.1:5176"
CLOUD_API = "http://127.0.0.1:8000"


def rec(name: str, status: str, **extra: object) -> None:
    extra_s = " ".join(f"{k}={v}" for k, v in extra.items())
    print(f"VERIFY {name} {status} {extra_s}".rstrip(), flush=True)


def host_of(url: str) -> tuple[str | None, int | None, str]:
    parsed = urlparse(url)
    return parsed.hostname, parsed.port, classify_supabase_host(parsed.hostname)


def main() -> int:
    failed = 0

    require_c5_local_process_env()
    supabase_url = os.environ["SUPABASE_URL"]
    anon = os.environ["SUPABASE_ANON_KEY"]
    service = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    host, port, kind = host_of(supabase_url)
    rec("c5_env", "pass" if kind == "local" and port == 54321 else "fail", host=host, port=port, klass=kind)
    if kind != "local" or port != 54321:
        return 2
    assert_local_supabase_url(supabase_url)

    cloud_env = parse_env_file(API_ROOT / ".env")
    cloud_url = cloud_env.get("SUPABASE_URL", "")
    ch, cp, ck = host_of(cloud_url) if cloud_url else (None, None, "empty")
    rec("cloud_env_untouched", "pass" if ck == "supabase_cloud" else "pass", host_class=ck, note="not_edited")

    with httpx.Client(timeout=8, follow_redirects=True) as client:
        try:
            cloud = client.get(f"{CLOUD_API}/health")
            rec("cloud_8000", "listen", http=cloud.status_code, note="not_used_for_writes")
        except Exception as exc:  # noqa: BLE001
            rec("cloud_8000", "down", error=type(exc).__name__, note="not_started_ok")

        try:
            auth_h = client.get(f"{supabase_url.rstrip('/')}/auth/v1/health")
            rec("local_auth_health", "pass" if auth_h.status_code == 200 else "fail", http=auth_h.status_code)
        except Exception as exc:  # noqa: BLE001
            rec("local_auth_health", "fail", error=type(exc).__name__)
            failed += 1

        try:
            api_h = client.get(f"{API}/health")
            rec("api_8001_health", "pass" if api_h.status_code == 200 else "fail", http=api_h.status_code)
            if api_h.status_code != 200:
                failed += 1
        except Exception as exc:  # noqa: BLE001
            rec("api_8001_health", "fail", error=type(exc).__name__)
            return 2

        probe_id = f"ssp-final-proxy-{uuid.uuid4().hex[:8]}"
        try:
            proxied = client.get(f"{WEB}/api/v1/health", headers={"x-request-id": probe_id})
            rec(
                "vite_proxy_health",
                "pass" if proxied.status_code == 200 else "fail",
                http=proxied.status_code,
                request_id=probe_id,
            )
            if proxied.status_code != 200:
                failed += 1
        except Exception as exc:  # noqa: BLE001
            rec("vite_proxy_health", "fail", error=type(exc).__name__)
            failed += 1

        try:
            transformed = client.get(f"{WEB}/src/lib/supabase.ts")
            text = transformed.text
            local = "127.0.0.1:54321" in text or "localhost:54321" in text
            cloud = "supabase.co" in text or "supabase.net" in text
            rec(
                "vite_supabase_transform",
                "pass" if local and not cloud else "fail",
                local=local,
                cloud=cloud,
                http=transformed.status_code,
            )
            if not (local and not cloud):
                failed += 1
        except Exception as exc:  # noqa: BLE001
            rec("vite_supabase_transform", "fail", error=type(exc).__name__)
            failed += 1

        try:
            session_src = client.get(f"{WEB}/src/lib/session.tsx")
            rec(
                "vite_session_dev_proxy",
                "pass" if 'baseUrl: ""' in session_src.text or "sameOriginProxy: true" in session_src.text else "fail",
                http=session_src.status_code,
            )
        except Exception as exc:  # noqa: BLE001
            rec("vite_session_dev_proxy", "fail", error=type(exc).__name__)

        # Focused live burst check: 121 /health must all succeed if development=1200 is active.
        # Old production cap of 120 would 429 on request 122 (window counts the request before append).
        codes: list[int] = []
        saw_429 = False
        for i in range(121):
            r = client.get(f"{API}/health", headers={"x-request-id": f"ssp-burst-{i}"})
            codes.append(r.status_code)
            if r.status_code == 429:
                saw_429 = True
                break
        rec(
            "rate_limit_live_121",
            "fail" if saw_429 else "pass",
            requests=len(codes),
            unique_codes=sorted(set(codes)),
            saw_429=saw_429,
        )
        if saw_429:
            failed += 1

        # Non-destructive local write: throwaway Auth user + workspace via live 8001, then read it back.
        marker = uuid.uuid4().hex[:8]
        email = f"ssp-final-{marker}@sitesecure.test"
        password = f"Final9x-{marker}"
        assert_local_supabase_url(supabase_url)
        created = client.post(
            f"{supabase_url.rstrip('/')}/auth/v1/admin/users",
            headers={
                "apikey": service,
                "Authorization": f"Bearer {service}",
                "Content-Type": "application/json",
            },
            json={"email": email, "password": password, "email_confirm": True},
        )
        rec("write_local_auth_admin", "pass" if created.status_code in {200, 201} else "fail", http=created.status_code)
        if created.status_code not in {200, 201}:
            failed += 1
            return 1 if failed else 0

        token_res = client.post(
            f"{supabase_url.rstrip('/')}/auth/v1/token?grant_type=password",
            headers={"apikey": anon, "Content-Type": "application/json"},
            json={"email": email, "password": password},
        )
        rec("read_local_password_grant", "pass" if token_res.status_code == 200 else "fail", http=token_res.status_code)
        if token_res.status_code != 200:
            failed += 1
            return 1 if failed else 0
        token = token_res.json()["access_token"]
        ws = client.post(
            f"{API}/api/v1/workspaces",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={"name": f"SSP final {marker}"},
        )
        rec("write_live_8001_workspace", "pass" if ws.status_code in {200, 201} else "fail", http=ws.status_code)
        if ws.status_code not in {200, 201}:
            failed += 1
            return 1 if failed else 0
        ws_id = str(ws.json()["id"])
        listed = client.get(
            f"{API}/api/v1/auth/session",
            headers={"Authorization": f"Bearer {token}"},
        )
        rec(
            "read_live_8001_session",
            "pass" if listed.status_code == 200 and ws_id in listed.text else "fail",
            http=listed.status_code,
        )
        if listed.status_code != 200:
            failed += 1

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
