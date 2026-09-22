from __future__ import annotations

import json
import sys
from pathlib import Path

import httpx

WS = "f1f76d59-fd2e-4b27-9586-06f7c89abc9c"
QID = "9d2f1103-7c02-437a-af9e-f680bc8f8b32"
API = "http://127.0.0.1:8000"
token = Path(__file__).with_name(".tmp_import_token").read_text(encoding="utf-8").strip()
h = {"Authorization": f"Bearer {token}"}
results: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok, detail))
    print(("PASS" if ok else "FAIL"), name, detail)


with httpx.Client(timeout=60, follow_redirects=True) as c:
    r = c.get(f"{API}/api/v1/workspaces/{WS}/quotes/{QID}/document", headers=h)
    check("document", r.status_code == 200, str(r.status_code))
    doc = r.json() if r.status_code == 200 else {}
    check("no_cost_leak", "cost_total" not in doc and "margin_amount" not in doc and "internal_notes" not in doc, "")
    check("has_sections_or_items", bool(doc.get("sections") is not None and doc.get("items")), "")
    check(
        "customer_shendi",
        (doc.get("customer") or {}).get("display_name") == "שנידי הלר",
        str((doc.get("customer") or {}).get("display_name")),
    )

    r = c.get(f"{API}/api/v1/workspaces/{WS}/quotes/{QID}/pdf", headers=h)
    check("pdf_status", r.status_code == 200, f"{r.status_code} {r.text[:120]}")
    check("pdf_magic", r.content[:4] == b"%PDF", r.content[:8].decode("latin1", errors="replace"))
    check(
        "pdf_filename",
        "SITE-SECURE-QUOTE" in (r.headers.get("content-disposition") or ""),
        r.headers.get("content-disposition") or "",
    )
    Path(__file__).resolve().parents[1].joinpath("_e2e_quote.pdf").write_bytes(r.content)

    r = c.post(f"{API}/api/v1/workspaces/{WS}/quotes/{QID}/share", headers=h)
    check("share_status", r.status_code == 200, f"{r.status_code} {r.text[:220]}")
    share = r.json() if r.status_code == 200 else {}
    url = share.get("public_url") or ""
    tok = share.get("public_token") or ""
    check("share_url", url.startswith("http") and "/public/quotes/" in url, url)

    r = c.get(f"{API}/api/v1/workspaces/{WS}/quotes/{QID}", headers=h)
    q = r.json() if r.status_code == 200 else {}
    check("status_sent_or_later", q.get("status") in {"sent", "viewed", "approved"}, str(q.get("status")))

    r = c.get(f"{API}/api/v1/public/quotes/{tok}")
    check("public_get", r.status_code == 200, str(r.status_code))
    pub = r.json() if r.status_code == 200 else {}
    check("public_no_cost", "cost_total" not in pub and "margin_amount" not in pub, "")
    check("public_can_approve", pub.get("can_approve") is True, str(pub.get("can_approve")))

    r = c.get(f"{API}/api/v1/public/quotes/{tok}/pdf")
    check("public_pdf", r.status_code == 200 and r.content[:4] == b"%PDF", str(r.status_code))

    r = c.post(
        f"{API}/api/v1/public/quotes/{tok}/approve",
        json={"name": "שנידי הלר", "user_agent": "e2e-audit"},
    )
    check("approve", r.status_code == 200, f"{r.status_code} {r.text[:180]}")
    appr = r.json() if r.status_code == 200 else {}
    check("approved_status", appr.get("status") == "approved", str(appr.get("status")))

    r = c.get(f"{API}/api/v1/workspaces/{WS}/quotes/{QID}", headers=h)
    q2 = r.json() if r.status_code == 200 else {}
    check("live_approved", q2.get("status") == "approved", str(q2.get("status")))

    r = c.get(f"{API}/api/v1/workspaces/{WS}/quotes/{QID}/events", headers=h)
    events = (r.json() or {}).get("items") if r.status_code == 200 else []
    types = {e.get("event_type") for e in events or []}
    check("event_sent_or_shared", "sent" in types or "shared" in types, str(sorted(types)))
    check("event_approved", "approved" in types, str(sorted(types)))
    check("event_pdf", "pdf_generated" in types, str(sorted(types)))

print("---")
failed = [x for x in results if not x[1]]
print(f"passed={len(results) - len(failed)} failed={len(failed)} total={len(results)}")
for name, _ok, detail in failed:
    print("BLOCKED", name, detail)
sys.exit(1 if failed else 0)
