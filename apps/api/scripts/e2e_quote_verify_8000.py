from __future__ import annotations

import sys
from pathlib import Path

import httpx

API = "http://127.0.0.1:8000"
WS = "f1f76d59-fd2e-4b27-9586-06f7c89abc9c"
Q = "9d2f1103-7c02-437a-af9e-f680bc8f8b32"
token = Path(__file__).with_name(".tmp_import_token").read_text(encoding="utf-8").strip()
h = {"Authorization": f"Bearer {token}"}
checks: list[tuple[str, bool, str]] = []


def ck(name: str, ok: bool, detail: str = "") -> None:
    checks.append((name, ok, detail))
    print(("PASS" if ok else "FAIL"), name, detail)


with httpx.Client(timeout=60) as c:
    r = c.get(f"{API}/api/v1/workspaces/{WS}/quotes/{Q}/document", headers=h)
    doc = r.json() if r.status_code == 200 else {}
    ck("document", r.status_code == 200, str(r.status_code))
    ck("no_cost", "cost_total" not in doc and "margin_amount" not in doc and "internal_notes" not in doc)
    ck(
        "customer",
        (doc.get("customer") or {}).get("display_name") == "שנידי הלר",
        str((doc.get("customer") or {}).get("display_name")),
    )

    r = c.get(f"{API}/api/v1/workspaces/{WS}/quotes/{Q}/pdf", headers=h)
    ck(
        "pdf",
        r.status_code == 200 and r.content[:4] == b"%PDF",
        f"{r.status_code} {r.headers.get('content-disposition')}",
    )

    r = c.post(f"{API}/api/v1/workspaces/{WS}/quotes/{Q}/share", headers=h)
    ck("share", r.status_code == 200, f"{r.status_code} {r.text[:120]}")
    share = r.json() if r.status_code == 200 else {}
    tok = share.get("public_token") or ""
    ck("share_not_auto_sent", share.get("auto_sent") is False, str(share.get("auto_sent")))

    r = c.get(f"{API}/api/v1/public/quotes/{tok}")
    pub = r.json() if r.status_code == 200 else {}
    ck("public", r.status_code == 200 and "cost_total" not in pub, str(r.status_code))

    r = c.get(f"{API}/api/v1/public/quotes/{tok}/pdf")
    ck("public_pdf", r.status_code == 200 and r.content[:4] == b"%PDF", str(r.status_code))

    r = c.get(f"{API}/api/v1/workspaces/{WS}/quotes/{Q}", headers=h)
    q = r.json() if r.status_code == 200 else {}
    ck("status_approved", q.get("status") == "approved", str(q.get("status")))

    r = c.get(f"{API}/api/v1/workspaces/{WS}/quotes/{Q}/events", headers=h)
    types = {e["event_type"] for e in (r.json() or {}).get("items", [])}
    ck(
        "events",
        {"approved", "pdf_generated"} <= types
        and (("shared" in types) or ("share_link_created" in types) or ("sent" in types)),
        str(sorted(types)),
    )

    r = c.post(f"{API}/api/v1/workspaces/{WS}/quotes/{Q}/share")
    ck("share_unauth", r.status_code in (401, 403), str(r.status_code))

failed = [x for x in checks if not x[1]]
print("---")
print(f"passed={len(checks) - len(failed)} failed={len(failed)} total={len(checks)}")
for name, _ok, detail in failed:
    print("BLOCKED", name, detail)
sys.exit(1 if failed else 0)
