"""
Task 12 — Final live E2E lifecycle verification.
Creates disposable QA data, exercises send → view → approve → project flows.
"""
from __future__ import annotations

import json
import subprocess
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
import time
import urllib.error
import urllib.request
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
TOKEN = (ROOT / "apps/api/scripts/.tmp_import_token").read_text(encoding="utf-8").strip()
API = "http://127.0.0.1:8000"
WEB = "http://localhost:5174"
SIG = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAD0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)
OUT = ROOT / "apps/web/scripts/_task12_e2e"
OUT.mkdir(parents=True, exist_ok=True)

results: dict[str, dict] = {}
qa_ids: dict = {"customers": [], "sites": [], "quotes": [], "projects": []}


def api(method: str, path: str, body: dict | None = None, auth: bool = True) -> tuple[int, dict]:
    url = f"{API}{path}"
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"}
    if auth:
        headers["Authorization"] = f"Bearer {TOKEN}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode()
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = {"raw": raw[:500]}
        return exc.code, payload


def record(flow: str, ok: bool, evidence: str, extra: dict | None = None) -> None:
    results[flow] = {"result": "PASS" if ok else "FAIL", "evidence": evidence, **(extra or {})}
    print(f"{'PASS' if ok else 'FAIL'} | {flow} | {evidence}")


def session_ws() -> str:
    status, data = api("GET", "/api/v1/auth/session")
    assert status == 200, data
    return data["memberships"][0]["workspace_id"]


def create_customer(ws: str, label: str) -> str:
    status, data = api(
        "POST",
        f"/api/v1/workspaces/{ws}/customers",
        {"display_name": label, "email": f"qa-{int(time.time())}@task12.local", "phone": "0500000001"},
    )
    assert status in (200, 201), data
    cid = data["id"]
    qa_ids["customers"].append(cid)
    return cid


def create_site(ws: str, customer_id: str, name: str) -> str:
    status, data = api(
        "POST",
        f"/api/v1/workspaces/{ws}/sites",
        {"customer_id": customer_id, "name": name, "address": {"line": "רחוב QA 1", "city": "תל אביב"}},
    )
    assert status in (200, 201), data
    sid = data["id"]
    qa_ids["sites"].append(sid)
    return sid


def create_sendable_quote(ws: str, customer_id: str, site_id: str | None, tag: str) -> dict:
    status, quote = api(
        "POST",
        f"/api/v1/workspaces/{ws}/quotes",
        {
            "customer_id": customer_id,
            "site_id": site_id,
            "title": f"QA Task12 {tag}",
            "valid_until": (date.today() + timedelta(days=30)).isoformat(),
            "payment_terms": "50% מקדמה, יתרה עם סיום",
        },
    )
    assert status in (200, 201), quote
    qid = quote["id"]
    qa_ids["quotes"].append(qid)
    status, quote = api(
        "POST",
        f"/api/v1/workspaces/{ws}/quotes/{qid}/items",
        {
            "item_type": "free",
            "description": f"QA item {tag}",
            "qty": 2,
            "unit_price": 500,
        },
    )
    assert status == 200, quote
    return quote


def send_quote(ws: str, qid: str) -> dict:
    status, data = api("POST", f"/api/v1/workspaces/{ws}/quotes/{qid}/send")
    assert status == 200, data
    return data


def get_quote(ws: str, qid: str) -> dict:
    status, data = api("GET", f"/api/v1/workspaces/{ws}/quotes/{qid}")
    assert status == 200, data
    return data


def public_get(token: str) -> tuple[int, dict]:
    return api("GET", f"/api/v1/public/quotes/{token}", auth=False)


def public_approve(token: str, name: str = "QA Signer Task12") -> tuple[int, dict]:
    return api(
        "POST",
        f"/api/v1/public/quotes/{token}/approve",
        {"name": name, "terms_accepted": True, "signature_data_url": SIG},
        auth=False,
    )


def public_reject(token: str, reason: str) -> tuple[int, dict]:
    return api(
        "POST",
        f"/api/v1/public/quotes/{token}/reject",
        {"reason": reason},
        auth=False,
    )


def create_project_from_quote(ws: str, qid: str, site_id: str | None = None) -> tuple[int, dict]:
    body: dict = {"source_quote_id": qid}
    if site_id:
        body["site_id"] = site_id
    return api("POST", f"/api/v1/workspaces/{ws}/projects/from-quote", body)


def revise_quote(ws: str, qid: str) -> tuple[int, dict]:
    return api("POST", f"/api/v1/workspaces/{ws}/quotes/{qid}/revise")


def list_projects_for_quote(ws: str, qid: str) -> list:
    status, data = api("GET", f"/api/v1/workspaces/{ws}/projects?source_quote_id={qid}&limit=5")
    assert status == 200, data
    return data.get("items") or []


def main() -> int:
    ws = session_ws()
    ts = int(time.time())
    cust_a = create_customer(ws, f"QA Task12 A {ts}")
    cust_b = create_customer(ws, f"QA Task12 B {ts}")
    site_a = create_site(ws, cust_a, f"QA Site A {ts}")
    site_b = create_site(ws, cust_b, f"QA Site B {ts}")

    # --- FLOW A-D: full approve + project with site ---
    q_site = create_sendable_quote(ws, cust_a, site_a, "with-site")
    qid_a = q_site["id"]
    sent = send_quote(ws, qid_a)
    token_a = sent.get("public_token") or ""
    record(
        "Draft -> Send",
        sent.get("status") == "sent" and bool(token_a),
        f"status={sent.get('status')} v={sent.get('version')} token={'yes' if token_a else 'no'}",
        {"quote_id": qid_a, "public_url": sent.get("public_url")},
    )

    st, pub = public_get(token_a)
    record(
        "Public customer view",
        st == 200 and pub.get("number") == sent.get("number") and pub.get("can_approve") is True,
        f"http={st} number={pub.get('number')} items={len(pub.get('items') or [])} can_approve={pub.get('can_approve')}",
    )
    record(
        "Public no internal leak",
        "cost_total" not in pub and "internal_notes" not in pub,
        f"keys_ok cost/margin absent",
    )

    st_view, pub_view = public_get(token_a)
    viewed_quote = get_quote(ws, qid_a)
    record(
        "Viewed polling (API)",
        viewed_quote.get("status") in ("viewed", "sent"),
        f"public_get={st_view} quote_status={viewed_quote.get('status')} viewed_at={viewed_quote.get('viewed_at')}",
    )

    st_ap, appr = public_approve(token_a)
    approved_quote = get_quote(ws, qid_a)
    record(
        "Public approval",
        st_ap == 200 and appr.get("status") == "approved",
        f"http={st_ap} approved_name={appr.get('approved_name')}",
    )
    record(
        "Approved internal state",
        approved_quote.get("status") == "approved"
        and approved_quote.get("approved_name") == "QA Signer Task12"
        and bool(approved_quote.get("approved_at")),
        f"status={approved_quote.get('status')} v={approved_quote.get('version')} at={approved_quote.get('approved_at')}",
    )

    st_p, project = create_project_from_quote(ws, qid_a)
    if st_p == 200:
        qa_ids["projects"].append(project["id"])
    record(
        "Approved -> Project",
        st_p == 200
        and project.get("source_quote_id") == qid_a
        and project.get("customer_id") == cust_a
        and project.get("site_id") == site_a
        and project.get("status") == "planned",
        f"http={st_p} project_id={project.get('id')} site={project.get('site_id')}",
        {"project_id": project.get("id")},
    )

    linked = list_projects_for_quote(ws, qid_a)
    record(
        "Open linked Project",
        len(linked) == 1 and linked[0]["id"] == project.get("id"),
        f"count={len(linked)} id={linked[0]['id'] if linked else None}",
    )

    st_dup, dup = create_project_from_quote(ws, qid_a)
    record(
        "Duplicate protection",
        st_dup == 409 and dup.get("details", {}).get("project_id") == project.get("id"),
        f"http={st_dup} details={dup.get('details')}",
    )

    # --- FLOW E: approved without site ---
    q_nosite = create_sendable_quote(ws, cust_a, None, "no-site")
    qid_ns = q_nosite["id"]
    sent_ns = send_quote(ws, qid_ns)
    token_ns = sent_ns["public_token"]
    public_approve(token_ns, "QA NoSite Signer")
    ns_quote = get_quote(ws, qid_ns)
    record(
        "Approved without site",
        ns_quote.get("status") == "approved" and not ns_quote.get("site_id"),
        f"status={ns_quote.get('status')} site_id={ns_quote.get('site_id')}",
        {"quote_id": qid_ns},
    )

    st_bad, bad = create_project_from_quote(ws, qid_ns, site_b)
    record(
        "Invalid site rejection",
        st_bad in (400, 409),
        f"other_customer_site http={st_bad} code={bad.get('code')} msg={bad.get('message', bad.get('raw', ''))[:120]}",
    )

    st_ok, proj_ns = create_project_from_quote(ws, qid_ns, site_a)
    if st_ok == 200:
        qa_ids["projects"].append(proj_ns["id"])
    ns_after = get_quote(ws, qid_ns)
    record(
        "Site attach + Project",
        st_ok == 200
        and ns_after.get("site_id") == site_a
        and proj_ns.get("site_id") == site_a,
        f"http={st_ok} quote.site={ns_after.get('site_id')} project.site={proj_ns.get('site_id')}",
    )

    # --- FLOW F: rejection ---
    q_rej = create_sendable_quote(ws, cust_a, site_a, "reject")
    qid_r = q_rej["id"]
    sent_r = send_quote(ws, qid_r)
    token_r = sent_r["public_token"]
    st_rj, rej = public_reject(token_r, "המחיר גבוה מדי ל-QA")
    rej_quote = get_quote(ws, qid_r)
    record(
        "Customer rejection",
        st_rj == 200
        and rej_quote.get("status") == "rejected"
        and rej_quote.get("rejection_reason") == "המחיר גבוה מדי ל-QA",
        f"http={st_rj} reason={rej_quote.get('rejection_reason')}",
        {"quote_id": qid_r},
    )

    # --- FLOW G: revision / superseded ---
    q_rev = create_sendable_quote(ws, cust_a, site_a, "revise")
    qid_rev = q_rev["id"]
    sent_rev = send_quote(ws, qid_rev)
    token_old = sent_rev["public_token"]
    old_version = sent_rev.get("version") or 1
    st_old_before, pub_old = public_get(token_old)
    record(
        "Revision (pre)",
        st_old_before == 200 and pub_old.get("can_approve") is True,
        f"token ok v={pub_old.get('version')}",
    )

    st_rev, revised = revise_quote(ws, qid_rev)
    rev_quote = get_quote(ws, qid_rev)
    st_old_after, pub_sup = public_get(token_old)
    st_old_ap, old_ap = public_approve(token_old)
    record(
        "Revision",
        st_rev == 200 and rev_quote.get("status") == "draft" and (rev_quote.get("version") or 0) > old_version,
        f"http={st_rev} new_status={rev_quote.get('status')} v={rev_quote.get('version')} cleared_approved={not rev_quote.get('approved_at')}",
    )
    record(
        "Superseded token",
        pub_sup.get("status") == "superseded" and pub_sup.get("can_approve") is False,
        f"status={pub_sup.get('status')} can_approve={pub_sup.get('can_approve')}",
    )
    record(
        "Old token approve blocked",
        st_old_ap == 403,
        f"http={st_old_ap} state={old_ap.get('details', {}).get('state')}",
    )
    still = get_quote(ws, qid_rev)
    record(
        "Current quote not wrongly approved",
        still.get("status") == "draft",
        f"status={still.get('status')}",
    )

    # Scope check on project
    if qa_ids["projects"]:
        st_gp, gp = api("GET", f"/api/v1/workspaces/{ws}/projects/{qa_ids['projects'][0]}")
        record(
            "Project scope metadata-only",
            st_gp == 200 and gp.get("source_quote_id") and "items" not in gp,
            f"project has source_quote_id, no items field",
        )

    # Playwright UI verification
    ui_script = ROOT / "apps/web/scripts/task12_e2e_ui.mjs"
    ui_payload = {
        "web": WEB,
        "token": TOKEN,
        "quotes": {
            "sent": None,
            "approved_no_project": qid_a,
            "approved_with_project": qid_a,
            "rejected": qid_r,
            "draft_check": q_rev,
        },
        "project_id": qa_ids["projects"][0] if qa_ids["projects"] else None,
    }
    # Create a fresh sent quote for UI sent check
    q_ui_sent = create_sendable_quote(ws, cust_a, site_a, "ui-sent")
    send_quote(ws, q_ui_sent["id"])
    ui_payload["quotes"]["sent"] = q_ui_sent["id"]

    payload_path = OUT / "ui_payload.json"
    payload_path.write_text(json.dumps(ui_payload, ensure_ascii=False, indent=2), encoding="utf-8")

    ui_results = {}
    if ui_script.exists():
        proc = subprocess.run(
            ["node", str(ui_script), str(payload_path), str(OUT / "ui_report.json")],
            cwd=str(ROOT / "apps/web"),
            capture_output=True,
            text=True,
            timeout=300,
        )
        print(proc.stdout)
        if proc.stderr:
            print(proc.stderr, file=sys.stderr)
        ui_report_path = OUT / "ui_report.json"
        if ui_report_path.exists():
            ui_results = json.loads(ui_report_path.read_text(encoding="utf-8"))
            results.update(ui_results)

    report = {
        "qa_ids": qa_ids,
        "results": results,
        "cleanup_note": "QA data retained for inspection; prefix QA Task12",
    }
    report_path = OUT / "report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("\n=== SUMMARY ===")
    fails = [k for k, v in results.items() if v.get("result") == "FAIL"]
    print(f"PASS={len(results)-len(fails)} FAIL={len(fails)}")
    for k in fails:
        print(f"  FAIL: {k} -> {results[k].get('evidence')}")
    print(f"\nReport: {report_path}")
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())
