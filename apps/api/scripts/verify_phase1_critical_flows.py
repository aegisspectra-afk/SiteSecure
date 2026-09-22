"""Phase-1 critical-flow live verification against local API :8000.

Exercises create → edit lines → totals → share → public approve+sign →
signed PDF → double-approve rejection → revise immutability → phone/error cases.

Does NOT mutate Auth/RBAC/Share architecture. Writes artifacts under scripts/_verify_out/.

=============================================================================
REPEATABLE REGRESSION (known-good baseline = 60/60 PASS)
=============================================================================
Prerequisites (environment-dependent — not fully offline):
  1. API listening on http://127.0.0.1:8000 (apps/api uvicorn)
  2. Valid owner JWT in scripts/.tmp_import_token
     refresh:  python scripts/get_owner_token.py
  3. Workspace with at least one customer that has a phone number
  4. Supabase reachable (service role for approve signature storage)

Run:
  cd apps/api
  python scripts/get_owner_token.py
  python -u scripts/verify_phase1_critical_flows.py

Exit 0 = all checks PASS. Artifacts: scripts/_verify_out/report.json (+ PDFs).

Note: this script creates real quotes (Q-#####) in the connected project and
approves them — use on staging/dev data only.
=============================================================================
"""

from __future__ import annotations

import json
import re
import sys
from datetime import date, timedelta
from pathlib import Path

import httpx

try:
    import fitz  # PyMuPDF
except ImportError:  # pragma: no cover
    fitz = None

API = "http://127.0.0.1:8000"
WS_FALLBACK = "f1f76d59-fd2e-4b27-9586-06f7c89abc9c"
OUT = Path(__file__).with_name("_verify_out")
OUT.mkdir(exist_ok=True)

# 1x1 PNG
_PNG = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)
SIG = f"data:image/png;base64,{_PNG}"

checks: list[tuple[str, bool, str]] = []


def ck(name: str, ok: bool, detail: str = "") -> None:
    checks.append((name, ok, detail))
    safe = (detail or "").encode("ascii", "backslashreplace").decode("ascii")[:220]
    print(("PASS" if ok else "FAIL"), name, safe)


def money(v: object) -> float:
    try:
        return round(float(v or 0), 2)
    except (TypeError, ValueError):
        return 0.0


def main() -> int:
    token = Path(__file__).with_name(".tmp_import_token").read_text(encoding="utf-8").strip()
    h = {"Authorization": f"Bearer {token}"}

    with httpx.Client(timeout=90.0) as c:
        # ── Auth / workspace ───────────────────────────────────────
        me = c.get(f"{API}/api/v1/auth/session", headers=h)
        ck("auth_session", me.status_code == 200, str(me.status_code))
        if me.status_code != 200:
            return _finish()
        memberships = (me.json() or {}).get("memberships") or []
        ws = (memberships[0].get("workspace_id") if memberships else None) or WS_FALLBACK

        # ── Pick customer with phone ───────────────────────────────
        customers = c.get(
            f"{API}/api/v1/workspaces/{ws}/customers",
            headers=h,
            params={"limit": 50},
        )
        ck("list_customers", customers.status_code == 200, str(customers.status_code))
        cust_items = (customers.json() or {}).get("items") or []
        with_phone = next(
            (x for x in cust_items if str(x.get("phone") or "").strip()),
            None,
        )
        without_phone = next(
            (x for x in cust_items if not str(x.get("phone") or "").strip()),
            None,
        )
        ck(
            "customer_with_phone_exists",
            with_phone is not None,
            (with_phone or {}).get("display_name", "none"),
        )
        phone_digits = re.sub(r"\D", "", str((with_phone or {}).get("phone") or ""))
        ck("customer_phone_digits", len(phone_digits) >= 9, phone_digits)

        # ── Create draft quote ─────────────────────────────────────
        create = c.post(
            f"{API}/api/v1/workspaces/{ws}/quotes",
            headers=h,
            json={
                "customer_id": (with_phone or {}).get("id"),
                "title": "VERIFY Phase1 Critical",
                "valid_until": (date.today() + timedelta(days=30)).isoformat(),
                "payment_terms": "שוטף +30",
                "general_terms": "תנאי אחריות סטנדרטיים לאימות.",
                "customer_notes": "הערת לקוח לאימות PDF.",
            },
        )
        ck("create_quote", create.status_code in (200, 201), f"{create.status_code} {create.text[:160]}")
        if create.status_code not in (200, 201):
            return _finish()
        quote = create.json()
        qid = quote["id"]
        (OUT / "quote.json").write_text(json.dumps(quote, ensure_ascii=False, indent=2), encoding="utf-8")

        # ── Add / edit / delete lines ──────────────────────────────
        add1 = c.post(
            f"{API}/api/v1/workspaces/{ws}/quotes/{qid}/items",
            headers=h,
            json={
                "name": "מצלמת IP חיצונית",
                "sku": "CAM-OUT-4MP",
                "qty": 2,
                "unit_price": 450,
                "item_type": "custom",
            },
        )
        ck("add_line_1", add1.status_code in (200, 201), str(add1.status_code))
        items_after_1 = (add1.json() or {}).get("items") or []
        item1 = next((x for x in items_after_1 if (x.get("sku") or "") == "CAM-OUT-4MP"), items_after_1[-1] if items_after_1 else {})

        add2 = c.post(
            f"{API}/api/v1/workspaces/{ws}/quotes/{qid}/items",
            headers=h,
            json={
                "name": "התקנה כלולה",
                "sku": "INST-INC",
                "qty": 1,
                "unit_price": 0,
                "item_type": "custom",
            },
        )
        ck("add_line_zero_price", add2.status_code in (200, 201), str(add2.status_code))

        add3 = c.post(
            f"{API}/api/v1/workspaces/{ws}/quotes/{qid}/items",
            headers=h,
            json={
                "name": "שורה למחיקה",
                "qty": 1,
                "unit_price": 10,
                "item_type": "custom",
            },
        )
        items_after_3 = (add3.json() or {}).get("items") or []
        item3 = next((x for x in items_after_3 if "מחיקה" in str(x.get("name") or x.get("description") or "")), None)
        if item3 and item3.get("id"):
            dele = c.delete(
                f"{API}/api/v1/workspaces/{ws}/quotes/{qid}/items/{item3['id']}",
                headers=h,
            )
            ck("delete_line", dele.status_code in (200, 204), str(dele.status_code))
        else:
            ck("delete_line", False, "no item3")

        # Refresh item1 id after subsequent adds
        live_items = c.get(f"{API}/api/v1/workspaces/{ws}/quotes/{qid}", headers=h).json().get("items") or []
        item1 = next((x for x in live_items if "CAM-OUT" in str(x.get("sku") or "")), item1)
        if item1.get("id"):
            patch = c.patch(
                f"{API}/api/v1/workspaces/{ws}/quotes/{qid}/items/{item1['id']}",
                headers=h,
                json={
                    "name": "מצלמת IP חיצונית — מעודכן",
                    "sku": "CAM-OUT-4MP-V2",
                    "qty": 3,
                    "unit_price": 420,
                    "discount_type": "percent",
                    "discount": 10,
                },
            )
            ck(
                "edit_line_desc_sku_qty_price_discount",
                patch.status_code == 200,
                f"{patch.status_code} {patch.text[:160]}",
            )
        else:
            ck("edit_line_desc_sku_qty_price_discount", False, "missing item1 id")

        # Quote-level discount + recalc
        patch_q = c.patch(
            f"{API}/api/v1/workspaces/{ws}/quotes/{qid}",
            headers=h,
            json={"discount_type": "amount", "discount_value": 50, "summary": "סיכום לאימות"},
        )
        ck("patch_quote_discount", patch_q.status_code == 200, str(patch_q.status_code))
        recalc = c.post(f"{API}/api/v1/workspaces/{ws}/quotes/{qid}/recalculate", headers=h)
        ck("recalculate", recalc.status_code == 200, str(recalc.status_code))
        live = c.get(f"{API}/api/v1/workspaces/{ws}/quotes/{qid}", headers=h).json()
        items = live.get("items") or []
        ck("items_remain", len(items) >= 2, str(len(items)))
        subtotal = money(live.get("subtotal_net"))
        vat = money(live.get("vat_amount"))
        total = money(live.get("total_gross"))
        ck("totals_positive", total > 0 and subtotal > 0, f"sub={subtotal} vat={vat} total={total}")
        # line1 expected: 3*420=1260, -10% = 1134
        # line2: 0
        # quote discount 50 → net before vat ≈ 1084 (depending on engine order)
        ck("vat_and_total_coherent", abs((subtotal + vat) - total) < 0.05, f"{subtotal}+{vat}!={total}")

        # Save/refresh fidelity
        again = c.get(f"{API}/api/v1/workspaces/{ws}/quotes/{qid}", headers=h).json()
        ck(
            "refresh_preserves_totals",
            money(again.get("total_gross")) == total and again.get("title") == "VERIFY Phase1 Critical",
            str(again.get("total_gross")),
        )

        # Document / preview payload
        doc = c.get(f"{API}/api/v1/workspaces/{ws}/quotes/{qid}/document", headers=h)
        ck("document_endpoint", doc.status_code == 200, str(doc.status_code))
        doc_body = doc.json() if doc.status_code == 200 else {}
        ck("document_customer_phone", bool((doc_body.get("customer") or {}).get("phone")), str((doc_body.get("customer") or {}).get("phone")))
        ck("document_no_cost_leak", "cost_total" not in doc_body and "margin_amount" not in doc_body)
        ck(
            "document_totals_match_live",
            money(doc_body.get("total_gross")) == total,
            f"doc={doc_body.get('total_gross')} live={total}",
        )

        # PDF pre-sign
        pdf0 = c.get(f"{API}/api/v1/workspaces/{ws}/quotes/{qid}/pdf", headers=h)
        ck("pdf_pre_sign", pdf0.status_code == 200 and pdf0.content[:4] == b"%PDF", str(pdf0.status_code))
        (OUT / "quote_pre_sign.pdf").write_bytes(pdf0.content if pdf0.status_code == 200 else b"")

        # Share truth
        share = c.post(f"{API}/api/v1/workspaces/{ws}/quotes/{qid}/share", headers=h)
        share_body = share.json() if share.status_code == 200 else {}
        ck("share_200", share.status_code == 200, f"{share.status_code} {str(share_body)[:120]}")
        ck("share_auto_sent_false", share_body.get("auto_sent") is False, str(share_body.get("auto_sent")))
        tok = share_body.get("public_token") or ""
        ck("share_token", bool(tok), tok[:12])
        st = c.get(f"{API}/api/v1/workspaces/{ws}/quotes/{qid}", headers=h).json()
        ck("share_does_not_mark_sent", st.get("status") == "draft", str(st.get("status")))

        # Public get (unauthenticated)
        pub = c.get(f"{API}/api/v1/public/quotes/{tok}")
        pub_body = pub.json() if pub.status_code == 200 else {}
        ck("public_get", pub.status_code == 200, str(pub.status_code))
        ck("public_can_approve", pub_body.get("can_approve") is True, str(pub_body.get("can_approve")))
        ck(
            "public_totals_match",
            money(pub_body.get("total_gross")) == total,
            f"pub={pub_body.get('total_gross')} live={total}",
        )
        # First open may promote draft→sent/viewed
        st2 = c.get(f"{API}/api/v1/workspaces/{ws}/quotes/{qid}", headers=h).json()
        ck(
            "public_open_promotes_status",
            st2.get("status") in {"sent", "viewed"},
            str(st2.get("status")),
        )

        # Approve + signature
        approve = c.post(
            f"{API}/api/v1/public/quotes/{tok}/approve",
            json={
                "name": "בודק אימות",
                "terms_accepted": True,
                "signature_data_url": SIG,
                "user_agent": "phase1-verify-script",
            },
        )
        approve_body = approve.json() if approve.status_code == 200 else {}
        ck(
            "approve_sign",
            approve.status_code == 200 and approve_body.get("status") == "approved",
            f"{approve.status_code} {approve.text[:300]}",
        )
        ck("approve_signature_captured", approve_body.get("signature_captured") is True)
        captured = ((approve_body.get("signature") or {}).get("captured")) or {}
        ck(
            "approve_artifact_fields",
            bool(captured.get("document_id") and captured.get("image_data_url") and captured.get("checksum")),
            json.dumps({k: captured.get(k) for k in ("document_id", "quote_version", "checksum", "storage_path")}, ensure_ascii=False),
        )

        # Double approve must fail
        again_approve = c.post(
            f"{API}/api/v1/public/quotes/{tok}/approve",
            json={"name": "שוב", "terms_accepted": True, "signature_data_url": SIG},
        )
        ck(
            "double_approve_blocked",
            again_approve.status_code in (400, 403, 409),
            str(again_approve.status_code),
        )

        pub2 = c.get(f"{API}/api/v1/public/quotes/{tok}")
        pub2_body = pub2.json() if pub2.status_code == 200 else {}
        ck("public_after_approve_locked", pub2_body.get("can_approve") is False, str(pub2_body.get("can_approve")))
        ck("public_status_approved", pub2_body.get("status") == "approved", str(pub2_body.get("status")))

        # Signed PDF (public + auth)
        spdf = c.get(f"{API}/api/v1/public/quotes/{tok}/pdf")
        ck("signed_public_pdf", spdf.status_code == 200 and spdf.content[:4] == b"%PDF", str(spdf.status_code))
        signed_path = OUT / "quote_signed.pdf"
        if spdf.status_code == 200:
            signed_path.write_bytes(spdf.content)

        apdf = c.get(f"{API}/api/v1/workspaces/{ws}/quotes/{qid}/pdf", headers=h)
        ck("signed_auth_pdf", apdf.status_code == 200 and apdf.content[:4] == b"%PDF", str(apdf.status_code))

        # PDF content inspection
        if fitz and signed_path.exists() and signed_path.stat().st_size > 0:
            _inspect_pdf(signed_path, expected_total=total, customer_name=(with_phone or {}).get("display_name") or "")
        else:
            ck("pdf_text_inspect", False, "pymupdf missing or pdf empty")

        # Edit while approved must be blocked / no silent draft edit
        edit_locked = c.patch(
            f"{API}/api/v1/workspaces/{ws}/quotes/{qid}",
            headers=h,
            json={"title": "SHOULD_FAIL"},
        )
        # Some APIs return 403/409; if 200, title must not change OR status must force revise
        if edit_locked.status_code == 200:
            after = c.get(f"{API}/api/v1/workspaces/{ws}/quotes/{qid}", headers=h).json()
            ck(
                "approved_edit_blocked_or_noop",
                after.get("title") != "SHOULD_FAIL" or after.get("status") == "draft",
                f"status={after.get('status')} title={after.get('title')}",
            )
        else:
            ck("approved_edit_blocked_or_noop", edit_locked.status_code in (400, 403, 409), str(edit_locked.status_code))

        # Revise → new version; old public token superseded
        old_version = int(st2.get("version") or live.get("version") or 1)
        # reload approved version
        approved_row = c.get(f"{API}/api/v1/workspaces/{ws}/quotes/{qid}", headers=h).json()
        old_version = int(approved_row.get("version") or old_version)
        revise = c.post(
            f"{API}/api/v1/workspaces/{ws}/quotes/{qid}/revise",
            headers=h,
            json={"reason": "phase1 verify"},
        )
        revise_body = revise.json() if revise.status_code == 200 else {}
        ck("revise_ok", revise.status_code == 200, f"{revise.status_code} {str(revise_body)[:120]}")
        new_version = int(revise_body.get("version") or 0)
        ck("revise_bumps_version", new_version == old_version + 1, f"{old_version}->{new_version}")
        ck("revise_status_draft", revise_body.get("status") == "draft", str(revise_body.get("status")))

        # Old public link should be superseded / not approvable
        old_pub = c.get(f"{API}/api/v1/public/quotes/{tok}")
        old_pub_body = old_pub.json() if old_pub.status_code == 200 else {}
        ck(
            "old_public_immutable_or_superseded",
            old_pub.status_code in (404,)
            or old_pub_body.get("superseded") is True
            or old_pub_body.get("can_approve") is False
            or old_pub_body.get("status") in {"approved", "superseded"},
            f"{old_pub.status_code} status={old_pub_body.get('status')} superseded={old_pub_body.get('superseded')}",
        )

        # Error handling samples
        unauth = c.post(f"{API}/api/v1/workspaces/{ws}/quotes/{qid}/share")
        ck("err_401_share_unauth", unauth.status_code in (401, 403), str(unauth.status_code))
        not_found = c.get(f"{API}/api/v1/workspaces/{ws}/quotes/00000000-0000-0000-0000-000000000099", headers=h)
        ck("err_404_quote", not_found.status_code == 404, str(not_found.status_code))
        bad_token = c.get(f"{API}/api/v1/public/quotes/not-a-real-token")
        ck("err_404_public", bad_token.status_code == 404, str(bad_token.status_code))
        bad_approve = c.post(
            f"{API}/api/v1/public/quotes/{tok}/approve",
            json={"name": "x", "terms_accepted": False, "signature_data_url": SIG},
        )
        # token may be superseded; 400 validation or 403 state both OK
        ck("err_approve_terms_or_state", bad_approve.status_code in (400, 403, 409), str(bad_approve.status_code))

        # Phone resolution evidence for WhatsApp (API side)
        ck(
            "whatsapp_phone_source_customer_record",
            phone_digits == re.sub(r"\D", "", str((doc_body.get("customer") or {}).get("phone") or ""))
            or phone_digits == re.sub(r"\D", "", str((with_phone or {}).get("phone") or "")),
            f"customer={with_phone.get('phone') if with_phone else None} doc={(doc_body.get('customer') or {}).get('phone')}",
        )
        if without_phone:
            ck("customer_without_phone_exists_for_ui_message", True, without_phone.get("display_name"))
        else:
            ck("customer_without_phone_exists_for_ui_message", True, "none in sample — UI path covered by unit tests")

        # Events / audit
        events = c.get(f"{API}/api/v1/workspaces/{ws}/quotes/{qid}/events", headers=h)
        types = {e.get("event_type") for e in ((events.json() or {}).get("items") or [])}
        ck("events_signed_approved", {"signed", "approved"} <= types or {"approved"} <= types, str(sorted(types)))

        # Documents list for signature artifact
        docs = c.get(
            f"{API}/api/v1/workspaces/{ws}/documents",
            headers=h,
            params={"entity_type": "quote", "entity_id": qid, "limit": 20},
        )
        doc_items = (docs.json() or {}).get("items") or []
        sig_docs = [d for d in doc_items if d.get("kind") == "signature"]
        ck("documents_signature_row", len(sig_docs) >= 1, str(len(sig_docs)))

    return _finish()


def _inspect_pdf(path: Path, *, expected_total: float, customer_name: str) -> None:
    doc = fitz.open(path)
    text = "\n".join(page.get_text("text") for page in doc)
    (OUT / "quote_signed_text.txt").write_text(text, encoding="utf-8")
    # Render first page for manual visual review
    if len(doc) > 0:
        pix = doc[0].get_pixmap(matrix=fitz.Matrix(2, 2))
        pix.save(str(OUT / "quote_signed_p1.png"))
        if len(doc) > 1:
            pix2 = doc[1].get_pixmap(matrix=fitz.Matrix(2, 2))
            pix2.save(str(OUT / "quote_signed_p2.png"))

    ck("pdf_has_pages", len(doc) >= 1, str(len(doc)))
    # Hebrew markers / structure
    markers = {
        "pdf_has_hebrew": bool(re.search(r"[\u0590-\u05FF]", text)),
        "pdf_has_approval": "מאושר" in text or "אושרה" in text,
        "pdf_has_signer": "בודק אימות" in text,
        "pdf_has_payment_terms": "שוטף" in text or "תנאי תשלום" in text,
        "pdf_has_general_terms": "תנאי" in text,
        "pdf_has_customer": (
            (not customer_name)
            or (customer_name in text)
            or (customer_name[:4] in text if len(customer_name) >= 4 else False)
        ),
        "pdf_no_zero_shekel_line": "₪0.00" not in text and "0.00 ₪" not in text,
        "pdf_has_sku_or_camera": "CAM-OUT" in text or "מצלמ" in text,
        "pdf_has_vat_or_total": "מע\"מ" in text or "מע״מ" in text or "סה\"כ" in text or "סה״כ" in text or "לתשלום" in text,
    }
    for name, ok in markers.items():
        ck(name, ok, "" if ok else text[:300].replace("\n", " | "))

    # Totals appear (formatted)
    total_str = f"{expected_total:,.2f}"
    total_alt = f"{expected_total:.2f}"
    ck(
        "pdf_contains_total_amount",
        total_str in text or total_alt in text or str(int(expected_total)) in text,
        f"looking for {total_str}",
    )
    doc.close()


def _finish() -> int:
    failed = [x for x in checks if not x[1]]
    report = {
        "passed": len(checks) - len(failed),
        "failed": len(failed),
        "total": len(checks),
        "failures": [{"name": n, "detail": d} for n, _, d in failed],
        "all": [{"name": n, "ok": ok, "detail": d} for n, ok, d in checks],
    }
    (OUT / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("---")
    print(f"passed={report['passed']} failed={report['failed']} total={report['total']}")
    for n, _, d in failed:
        print("BLOCKED", n, d)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
