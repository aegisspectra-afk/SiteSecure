from __future__ import annotations

import sys
from pathlib import Path

import httpx

API = "http://127.0.0.1:8000"
token = Path(__file__).with_name(".tmp_import_token").read_text(encoding="utf-8").strip()
h = {"Authorization": f"Bearer {token}"}


def ck(name: str, ok: bool, detail: str = "") -> bool:
    print(("PASS" if ok else "FAIL"), name, detail)
    return ok


ok_all = True
with httpx.Client(timeout=60) as c:
    me = c.get(f"{API}/api/v1/me", headers=h)
    ok_all &= ck("auth", me.status_code == 200, str(me.status_code))
    body = me.json() if me.status_code == 200 else {}
    memberships = body.get("memberships") or []
    ws = memberships[0].get("workspace_id") if memberships else None
    if not ws:
        ws = "f1f76d59-fd2e-4b27-9586-06f7c89abc9c"
    print("WS", ws)

    quotes = c.get(
        f"{API}/api/v1/workspaces/{ws}/quotes",
        headers=h,
        params={"status": "draft", "limit": 20},
    )
    ok_all &= ck("list_drafts", quotes.status_code == 200, str(quotes.status_code))
    items = (quotes.json() or {}).get("items") or []
    draft = next((q for q in items if q.get("status") == "draft" and q.get("customer_id")), None)
    if not draft and items:
        draft = items[0]
    if not draft:
        print("FAIL no_draft_quote")
        raise SystemExit(1)

    qid = draft["id"]
    print("QUOTE", draft.get("number"), qid, draft.get("status"))

    g1 = c.get(f"{API}/api/v1/workspaces/{ws}/quotes/{qid}", headers=h)
    status_before = (g1.json() or {}).get("status")
    ok_all &= ck("status_before_draft", status_before == "draft", str(status_before))

    share = c.post(f"{API}/api/v1/workspaces/{ws}/quotes/{qid}/share", headers=h)
    share_body = share.json() if "json" in share.headers.get("content-type", "") else {}
    err = share_body.get("error") if isinstance(share_body.get("error"), dict) else share_body
    code = err.get("code") if isinstance(err, dict) else None
    print("share_http", share.status_code, code, str(share_body)[:300])

    if share.status_code == 400 and code == "QUOTE_INCOMPLETE":
        ok_all &= ck("share_incomplete_truthful", True, "blocked without marking sent")
        g2 = c.get(f"{API}/api/v1/workspaces/{ws}/quotes/{qid}", headers=h)
        ok_all &= ck(
            "status_unchanged_on_incomplete",
            (g2.json() or {}).get("status") == "draft",
            str((g2.json() or {}).get("status")),
        )
    elif share.status_code == 200:
        ok_all &= ck("auto_sent_false", share_body.get("auto_sent") is False, str(share_body.get("auto_sent")))
        ok_all &= ck("link_created", bool(share_body.get("public_url")), str(share_body.get("public_url"))[:80])
        g2 = c.get(f"{API}/api/v1/workspaces/{ws}/quotes/{qid}", headers=h)
        status_after = (g2.json() or {}).get("status")
        ok_all &= ck("status_still_draft_after_share", status_after == "draft", str(status_after))
        tok = share_body.get("public_token")
        pub = c.get(f"{API}/api/v1/public/quotes/{tok}")
        ok_all &= ck("public_ok", pub.status_code == 200, str(pub.status_code))
        pdf = c.get(f"{API}/api/v1/workspaces/{ws}/quotes/{qid}/pdf", headers=h)
        ok_all &= ck(
            "pdf_ok",
            pdf.status_code == 200 and pdf.content[:4] == b"%PDF",
            str(pdf.status_code),
        )
        unauth = c.post(f"{API}/api/v1/workspaces/{ws}/quotes/{qid}/share")
        ok_all &= ck("share_unauth", unauth.status_code in (401, 403), str(unauth.status_code))
    else:
        ok_all &= ck("share_unexpected", False, f"{share.status_code} {str(share_body)[:200]}")

    # Also verify an already-complete / previously shareable quote if present among sent.
    sent_list = c.get(
        f"{API}/api/v1/workspaces/{ws}/quotes",
        headers=h,
        params={"status": "sent", "limit": 5},
    )
    sent_items = (sent_list.json() or {}).get("items") or [] if sent_list.status_code == 200 else []
    if sent_items:
        sid = sent_items[0]["id"]
        before_sent = c.get(f"{API}/api/v1/workspaces/{ws}/quotes/{sid}", headers=h).json().get("status")
        remint = c.post(f"{API}/api/v1/workspaces/{ws}/quotes/{sid}/share", headers=h)
        remint_body = remint.json() if remint.status_code == 200 else {}
        after_sent = c.get(f"{API}/api/v1/workspaces/{ws}/quotes/{sid}", headers=h).json().get("status")
        ok_all &= ck("remint_ok", remint.status_code == 200 and remint_body.get("auto_sent") is False, str(remint.status_code))
        ok_all &= ck("remint_keeps_status", before_sent == after_sent, f"{before_sent}->{after_sent}")


print("---")
print("SMOKE", "PASS" if ok_all else "FAIL")
sys.exit(0 if ok_all else 1)
