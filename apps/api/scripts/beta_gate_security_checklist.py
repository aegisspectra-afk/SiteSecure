"""Beta Gate — focused security probes (run against a configured API + owner token).

Usage:
  set SS_API_BASE=https://api.example.com
  set SS_OWNER_TOKEN=...
  set SS_WORKSPACE_A=...
  set SS_WORKSPACE_B=...
  python apps/api/scripts/beta_gate_security_checklist.py
"""

from __future__ import annotations

import os
import sys

import httpx

BASE = os.environ.get("SS_API_BASE", "http://127.0.0.1:8010").rstrip("/")
TOKEN = os.environ.get("SS_OWNER_TOKEN", "")
WS_A = os.environ.get("SS_WORKSPACE_A", "")
WS_B = os.environ.get("SS_WORKSPACE_B", "")


def main() -> int:
    if not TOKEN or not WS_A:
        print("SKIP: set SS_OWNER_TOKEN and SS_WORKSPACE_A")
        return 2
    h = {"Authorization": f"Bearer {TOKEN}"}
    fails: list[str] = []

    with httpx.Client(base_url=BASE, timeout=60.0, headers=h) as client:
        # Invite founding_technician role must be rejected
        r = client.post(
            f"/api/v1/workspaces/{WS_A}/invitations",
            json={"email": "beta-ft-reject@example.com", "role_key": "founding_technician"},
        )
        if r.status_code in {200, 201}:
            fails.append(f"invite founding_technician allowed: {r.status_code}")
        else:
            print("PASS invite founding_technician rejected", r.status_code)

        # Cross-workspace quotes list should not leak (if WS_B set)
        if WS_B:
            r = client.get(f"/api/v1/workspaces/{WS_B}/quotes", params={"limit": 5})
            if r.status_code == 200:
                # Owner of A may not be member of B — expect 403/404
                fails.append("cross-workspace quotes unexpectedly 200 for owner A token")
            else:
                print("PASS cross-workspace denied", r.status_code)

        # Admin endpoints require platform admin
        r = client.get("/api/v1/admin/users")
        if r.status_code == 200:
            print("NOTE admin/users 200 (token is platform admin)")
        elif r.status_code in {401, 403}:
            print("PASS admin/users denied for non-platform-admin", r.status_code)
        else:
            fails.append(f"admin/users unexpected {r.status_code}")

        # Catalog ensure-defaults requires edit
        r = client.post(f"/api/v1/workspaces/{WS_A}/catalog/ensure-defaults", json={})
        if r.status_code not in {200, 403}:
            fails.append(f"ensure-defaults unexpected {r.status_code}")
        else:
            print("PASS ensure-defaults", r.status_code)

        # Health
        r = client.get("/health")
        if r.status_code != 200:
            fails.append("health not 200")
        else:
            print("PASS health")

    if fails:
        print("FAIL")
        for f in fails:
            print(" -", f)
        return 1
    print("SECURITY GATE checks completed (manual IDOR/upload/PDF still required)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
