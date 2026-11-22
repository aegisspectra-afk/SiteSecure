"""B8: quote engine golden path on LOCAL Supabase (API chain).

Flow: empty quote → CCTV starter lines + 3 ועד-בית tiers (cctv/generate-alternatives) →
margin → site-tour photo → send → public view → choose alternative → approve+sign →
project + installation job.

Per alternative, ``total_gross`` must match across office (/alternatives, /document),
public JSON, and public PDF.

Manual gap: Playwright CCTV *מהיר* wizard UI is not exercised here; the server equivalent
is starter-catalog CCTV lines + ``POST .../cctv/generate-alternatives``.
"""

from __future__ import annotations

import base64
import uuid
from datetime import UTC, datetime, timedelta
from urllib.parse import urlparse

import httpx
import pymupdf
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from app.project_scope_from_quote import plan_project_scope_from_snapshot
from tests.test_d1_dashboard_live import _owner_workspace, _svc
from tests.test_ssp_c5_e2e_connection import _auth, _snippet

pytestmark = pytest.mark.live

SIGNATURE = "data:image/png;base64," + base64.b64encode(
    bytes.fromhex(
        "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
        "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082"
    )
).decode()

JPEG = (
    b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    b"\xff\xdb\x00C\x00" + b"\x08" * 64 + b"\xff\xd9"
)


def _set_plan(s, workspace_id: str, plan_key: str = "business") -> None:
    res = httpx.patch(
        f"{s.supabase_url}/rest/v1/subscriptions",
        headers=_svc(s),
        params={"workspace_id": f"eq.{workspace_id}"},
        json={"plan_key": plan_key, "status": "active"},
        timeout=30,
    )
    assert res.status_code in {200, 204}, res.text


def _money_label(total: float) -> str:
    return f"{total:,.2f}"


def _pdf_contains_total(pdf_bytes: bytes, total: float) -> bool:
    text = "".join(page.get_text() for page in pymupdf.open(stream=pdf_bytes, filetype="pdf"))
    label = _money_label(total)
    if label in text:
        return True
    # Fallback: ungrouped thousands or integer part only in cramped layouts.
    return label.replace(",", "") in text.replace(",", "") or f"{total:.2f}" in text


def _starter_product(s, ws: str, sku: str) -> dict:
    res = httpx.get(
        f"{s.supabase_url}/rest/v1/products",
        headers=_svc(s),
        timeout=30,
        params={"workspace_id": f"eq.{ws}", "sku": f"eq.{sku}", "select": "id,sku,name,list_price,cost"},
    )
    rows = res.json()
    assert rows, f"starter product {sku} missing — run against workspace with starter catalog"
    return rows[0]


def _load_version_snapshot(s, quote_id: str, version: int) -> dict:
    res = httpx.get(
        f"{s.supabase_url}/rest/v1/quote_versions",
        headers=_svc(s),
        timeout=30,
        params={
            "quote_id": f"eq.{quote_id}",
            "version": f"eq.{version}",
            "select": "snapshot",
            "limit": "1",
        },
    )
    assert res.status_code == 200, res.text
    rows = res.json()
    assert rows, "quote_versions row missing after send"
    snap = rows[0].get("snapshot")
    assert isinstance(snap, dict), snap
    return snap


@pytest.fixture(scope="module")
def settings():
    get_settings.cache_clear()
    try:
        s = get_settings()
    except Exception:
        pytest.skip("Supabase not configured")
    if urlparse(s.supabase_url).hostname not in {"127.0.0.1", "localhost"}:
        pytest.skip("B8 engine e2e runs against local Supabase only")
    if not s.supabase_service_role_key:
        pytest.skip("local service role key required")
    return s


def test_b8_quote_engine_golden_path_live(settings):
    s = settings
    api = TestClient(app)
    owner, ws = _owner_workspace(s, api, "b8-engine")
    _set_plan(s, ws, "business")
    tok = _auth(owner)
    base = f"/api/v1/workspaces/{ws}"

    cust = api.post(f"{base}/customers", headers=tok, json={"display_name": "לקוח B8"})
    assert cust.status_code == 200, _snippet(cust)
    customer_id = cust.json()["id"]
    site = api.post(
        f"{base}/sites",
        headers=tok,
        json={
            "customer_id": customer_id,
            "name": "אתר B8",
            "code": f"B8-{uuid.uuid4().hex[:6]}",
            "address_line1": "רחוב הבדיקה 1",
            "city": "תל אביב",
        },
    )
    assert site.status_code == 200, _snippet(site)
    site_id = site.json()["id"]

    # 1) Empty quote
    valid = (datetime.now(UTC) + timedelta(days=30)).date().isoformat()
    created = api.post(
        f"{base}/quotes",
        headers=tok,
        json={
            "customer_id": customer_id,
            "site_id": site_id,
            "title": "CCTV B8 מנוע",
            "valid_until": valid,
            "payment_terms": "40% מקדמה · 60% בגמר התקנה",
        },
    )
    assert created.status_code == 200, _snippet(created)
    qid = created.json()["id"]
    assert created.json()["status"] == "draft"

    # 2) CCTV fast-path equivalent: starter BOM on the quote
    cam = _starter_product(s, ws, "SS-CAM-4MP-DOME")
    nvr = _starter_product(s, ws, "SS-NVR-8CH-POE")
    for prod, qty in ((cam, 4), (nvr, 1)):
        added = api.post(
            f"{base}/quotes/{qid}/items",
            headers=tok,
            json={"product_id": prod["id"], "qty": qty},
        )
        assert added.status_code == 200, _snippet(added)

    gen = api.post(
        f"{base}/quotes/{qid}/cctv/generate-alternatives",
        headers=tok,
        json={"variant_axis": "resolution"},
    )
    assert gen.status_code == 200, _snippet(gen)
    alts = gen.json()["items"]
    assert len(alts) == 3, alts
    by_sort = sorted(alts, key=lambda a: int(a.get("sort_order") or 0))
    alt_ids = [str(a["id"]) for a in by_sort]
    recommended = next(a for a in by_sort if a.get("is_recommended"))
    chosen_id = str(recommended["id"])

    # Differentiate tier 3 so parity checks are meaningful across three totals.
    quote_after = api.get(f"{base}/quotes/{qid}", headers=tok)
    assert quote_after.status_code == 200, _snippet(quote_after)
    tier3_line = next(
        (i for i in quote_after.json()["items"] if str(i.get("alternative_id")) == alt_ids[2]),
        None,
    )
    assert tier3_line, "expected lines on tier 3"
    bumped = api.patch(
        f"{base}/quotes/{qid}/items/{tier3_line['id']}",
        headers=tok,
        json={"unit_price": float(tier3_line["unit_price"]) * 1.25},
    )
    assert bumped.status_code == 200, _snippet(bumped)

    office_alts = api.get(f"{base}/quotes/{qid}/alternatives", headers=tok)
    assert office_alts.status_code == 200, _snippet(office_alts)
    office_rows = {str(r["id"]): r for r in office_alts.json()["items"]}
    assert set(office_rows) == set(alt_ids)

    # 3) Profitability visible in office
    office_quote = api.get(f"{base}/quotes/{qid}", headers=tok).json()
    assert office_quote.get("margin_percent") is not None
    assert office_quote.get("cost_total") is not None

    # 4) Site-tour photo (B6)
    up = api.post(
        f"{base}/documents/uploads",
        headers=tok,
        json={
            "entity_type": "quote",
            "entity_id": qid,
            "kind": "photo",
            "mime_type": "image/jpeg",
            "original_filename": "tour.jpg",
            "byte_size": len(JPEG),
        },
    )
    assert up.status_code == 200, _snippet(up)
    upload = up.json()
    put = httpx.put(
        upload["upload_url"],
        content=JPEG,
        headers={"Content-Type": "image/jpeg"},
        timeout=30,
    )
    assert put.status_code in {200, 201}, put.text
    done = api.post(
        f"{base}/documents/{upload['document_id']}/complete",
        headers=tok,
        json={"byte_size": len(JPEG), "mime_type": "image/jpeg"},
    )
    assert done.status_code == 200, _snippet(done)

    # 5) Send
    sent = api.post(f"{base}/quotes/{qid}/send", headers=tok)
    assert sent.status_code == 200, _snippet(sent)
    public_token = sent.json()["public_token"]
    assert public_token

    doc = api.get(f"{base}/quotes/{qid}/document", headers=tok)
    assert doc.status_code == 200, _snippet(doc)
    doc_alts = {str(a["id"]): a for a in doc.json().get("alternatives") or []}

    pdf_res = api.get(f"/api/v1/public/quotes/{public_token}/pdf")
    assert pdf_res.status_code == 200, _snippet(pdf_res)
    pdf_bytes = pdf_res.content
    assert pdf_bytes[:4] == b"%PDF"

    # 6) View (marks viewed)
    public = api.get(f"/api/v1/public/quotes/{public_token}")
    assert public.status_code == 200, _snippet(public)
    assert public.json()["status"] in {"viewed", "sent"}
    pub_alts = {str(a["id"]): a for a in public.json().get("alternatives") or []}
    assert public.json().get("site_tour_photos"), "site tour photos should appear on public doc"

    for aid in alt_ids:
        office_total = float(office_rows[aid]["total_gross"])
        assert float(doc_alts[aid]["total_gross"]) == office_total
        assert float(pub_alts[aid]["total_gross"]) == office_total
        assert _pdf_contains_total(pdf_bytes, office_total), (
            f"PDF missing total {_money_label(office_total)} for alternative {aid}"
        )

    # 7–8) Choose alternative + approve + sign
    approved = api.post(
        f"/api/v1/public/quotes/{public_token}/approve",
        json={
            "name": "לקוח B8",
            "terms_accepted": True,
            "signature_data_url": SIGNATURE,
            "chosen_alternative_id": chosen_id,
        },
    )
    assert approved.status_code == 200, _snippet(approved)
    assert approved.json()["status"] == "approved"

    approved_quote = api.get(f"{base}/quotes/{qid}", headers=tok).json()
    assert approved_quote["status"] == "approved"
    assert str(approved_quote.get("approved_alternative_id")) == chosen_id

    # 9) Project + installation job from approved quote (chosen alternative scope)
    proj = api.post(f"{base}/projects/from-quote", headers=tok, json={"source_quote_id": qid})
    assert proj.status_code == 200, _snippet(proj)
    project_id = proj.json()["id"]
    assert proj.json().get("source_quote_id") == qid

    job = api.post(
        f"{base}/jobs",
        headers=tok,
        json={
            "title": "התקנת CCTV B8",
            "customer_id": customer_id,
            "site_id": site_id,
            "project_id": project_id,
            "kind": "installation",
        },
    )
    assert job.status_code == 200, _snippet(job)
    assert job.json().get("project_id") == project_id

    version = int(approved_quote.get("version") or 1)
    snap = _load_version_snapshot(s, qid, version)
    scope_rows = plan_project_scope_from_snapshot(
        snapshot=snap,
        workspace_id=ws,
        project_id=project_id,
        source_quote_id=qid,
        source_quote_version=version,
        approved_alternative_id=chosen_id,
    )
    assert scope_rows, "chosen alternative should yield planned scope rows"
    other_alt = next(aid for aid in alt_ids if aid != chosen_id)
    for raw in snap.get("items") or []:
        if str(raw.get("alternative_id")) == other_alt and raw.get("item_type") != "note":
            assert not any(
                r.get("source_quote_item_id") == raw.get("id") for r in scope_rows
            ), "scope must exclude non-chosen alternative lines"

    # Sanity: public payload never carried cost keys
    assert "cost_total" not in public.json()
    for alt in public.json().get("alternatives") or []:
        assert "cost_total" not in alt
        assert "margin_percent" not in alt