"""DEMO-2.1: the starter "sample price" mark is office-only, live on LOCAL Supabase.

The quote line, the public link and the PDF always carry the product name / description,
never "מחיר לדוגמה – עדכן".
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from urllib.parse import urlparse

import httpx
import pymupdf
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from tests.test_d1_dashboard_live import _owner_workspace, _svc
from tests.test_ssp_c5_e2e_connection import _auth, _snippet

pytestmark = pytest.mark.live

MARK = "מחיר לדוגמה – עדכן"


@pytest.fixture(scope="module")
def settings():
    get_settings.cache_clear()
    s = get_settings()
    assert urlparse(s.supabase_url).hostname in {"127.0.0.1", "localhost"}, "local Supabase only"
    return s


def _product(s, ws: str, sku: str) -> dict:
    res = httpx.get(f"{s.supabase_url}/rest/v1/products", headers=_svc(s), timeout=30,
                    params={"workspace_id": f"eq.{ws}", "sku": f"eq.{sku}", "select": "id,name,description,metadata"})
    rows = res.json()
    assert rows, f"starter product {sku} missing"
    return rows[0]


def _quote(api, tok, ws) -> str:
    cust = api.post(f"/api/v1/workspaces/{ws}/customers", headers=_auth(tok), json={"display_name": "לקוח דמו 2"})
    assert cust.status_code == 200, _snippet(cust)
    q = api.post(f"/api/v1/workspaces/{ws}/quotes", headers=_auth(tok),
                 json={"customer_id": cust.json()["id"], "title": "מערכת מצלמות"})
    assert q.status_code == 200, _snippet(q)
    qid = q.json()["id"]
    valid = (datetime.now(UTC) + timedelta(days=30)).date().isoformat()
    api.patch(f"/api/v1/workspaces/{ws}/quotes/{qid}", headers=_auth(tok),
              json={"valid_until": valid, "payment_terms": "שוטף + 30"}).raise_for_status()
    return qid


def test_starter_products_keep_the_mark_in_metadata_only(settings):
    s, api = settings, TestClient(app)
    _, ws = _owner_workspace(s, api, "demo2-starter")
    cam = _product(s, ws, "SS-CAM-4MP-DOME")
    assert (cam["description"] or "") != MARK
    assert (cam["metadata"] or {}).get("sample_price") is True


def test_quote_line_public_link_and_pdf_show_the_product_name(settings):
    s, api = settings, TestClient(app)
    tok, ws = _owner_workspace(s, api, "demo2-text")
    cam = _product(s, ws, "SS-CAM-4MP-DOME")
    nvr = _product(s, ws, "SS-NVR-4CH-POE")
    # Data written before the fix: the mark sits in the product description.
    httpx.patch(f"{s.supabase_url}/rest/v1/products", headers=_svc(s), params={"id": f"eq.{nvr['id']}"},
                json={"description": MARK}, timeout=30).raise_for_status()

    qid = _quote(api, tok, ws)
    for prod, qty in ((cam, 4), (nvr, 1)):
        res = api.post(f"/api/v1/workspaces/{ws}/quotes/{qid}/items", headers=_auth(tok),
                       json={"product_id": prod["id"], "qty": qty})
        assert res.status_code == 200, _snippet(res)
    items = res.json()["items"]
    assert {i["description"] for i in items} == {cam["name"], nvr["name"]}

    sent = api.post(f"/api/v1/workspaces/{ws}/quotes/{qid}/send", headers=_auth(tok))
    assert sent.status_code == 200, _snippet(sent)
    token = sent.json()["public_token"]
    public = api.get(f"/api/v1/public/quotes/{token}")
    assert public.status_code == 200, _snippet(public)
    assert MARK not in public.text
    assert cam["name"] in public.text

    pdf = api.get(f"/api/v1/public/quotes/{token}/pdf")
    assert pdf.status_code == 200, _snippet(pdf)
    text = "".join(page.get_text() for page in pymupdf.open(stream=pdf.content, filetype="pdf"))
    assert "לדוגמה" not in text
    assert "4MP" in text and "NVR" in text
