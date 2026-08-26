from app.quote_snapshot import catalog_line_snapshot, public_items, public_payload, version_snapshot


def test_catalog_snapshot_freezes_list_price():
    product = {
        "id": "p1",
        "sku": "CAM-1",
        "name": "מצלמה",
        "description": "4K",
        "unit": "unit",
        "kind": "product",
        "list_price": 1200,
        "cost": 700,
        "vat_eligible": True,
        "manufacturer": "Hikvision",
        "model": "DS-2CD",
        "attributes": {"resolution": "4K", "poe": True},
    }
    snap = catalog_line_snapshot(product)
    product["list_price"] = 9999
    product["manufacturer"] = "Other"
    assert snap["list_price"] == 1200
    assert snap["cost"] == 700
    assert snap["sku"] == "CAM-1"
    assert snap["manufacturer"] == "Hikvision"
    assert snap["model"] == "DS-2CD"
    assert snap["attributes"] == {"resolution": "4K", "poe": True}


def test_public_items_omit_cost():
    rows = public_items(
        [{"id": "i1", "item_type": "catalog", "description": "x", "qty": 1, "unit_price": 10, "cost": 4, "discount": 0, "line_net": 10}]
    )
    assert "cost" not in rows[0]
    assert rows[0]["unit_price"] == 10


def test_public_payload_omits_internal_pricing():
    payload = public_payload(
        {
            "id": "q1",
            "number": "Q-1",
            "version": 1,
            "status": "draft",
            "title": "התקנה",
            "cost_total": 400,
            "margin_amount": 200,
            "margin_percent": 33,
            "internal_notes": "לא ללקוח",
            "subtotal_net": 100,
            "vat_amount": 18,
            "total_gross": 118,
            "currency": "ILS",
            "vat_percent": 18,
        },
        [{"id": "i1", "item_type": "catalog", "description": "מצלמה", "qty": 1, "unit_price": 100, "cost": 40, "discount": 0, "line_net": 100}],
        workspace={"name": "Aegis"},
        customer={"display_name": "רומן"},
        site=None,
    )
    blob = str(payload)
    assert "cost_total" not in payload
    assert "margin_amount" not in payload
    assert "internal_notes" not in payload
    assert "400" not in blob
    assert payload["total_gross"] == 118
    assert payload["customer"]["display_name"] == "רומן"
    assert payload["issued_at"] is None
    assert "cost" not in payload["items"][0]


def test_public_payload_includes_sections_branding_signature():
    payload = public_payload(
        {
            "id": "q1",
            "number": "Q-12",
            "version": 1,
            "status": "sent",
            "subtotal_net": 8500,
            "vat_amount": 1530,
            "total_gross": 10030,
            "currency": "ILS",
            "vat_percent": 18,
            "payment_terms": "40/60",
        },
        [
            {
                "id": "i1",
                "item_type": "catalog",
                "description": "מצלמה",
                "qty": 1,
                "unit_price": 100,
                "cost": 40,
                "discount": 0,
                "line_net": 100,
                "section_id": "s1",
            }
        ],
        workspace={"name": "אגיס מערכות"},
        customer={"display_name": "איליה", "phone": "050", "email": "a@b.c"},
        site={"name": "אתר", "address": {"line": "רחוב 1"}},
        sections=[{"id": "s1", "name": "מערכת מצלמות", "sort_order": 0}],
        branding={"logo_url": "https://cdn.example/logo.png", "name": "אגיס", "phone": "03-111"},
    )
    assert payload["sections"] == [{"id": "s1", "name": "מערכת מצלמות", "sort_order": 0}]
    assert payload["company"]["logo_url"] == "https://cdn.example/logo.png"
    assert payload["company"]["brand_name"] == "אגיס"
    assert payload["company"]["phone"] == "03-111"
    assert payload["signature"]["mode"] == "signature_pad_v1"
    assert payload["signature"]["required"] is True
    assert "cost" not in str(payload["items"])
    assert payload["pdf_ready"] is True


def test_send_snapshot_includes_sections():
    snap = version_snapshot(
        {"id": "q1", "number": "Q-1", "version": 2, "status": "draft", "subtotal_net": 1, "vat_amount": 0, "total_gross": 1},
        [{"id": "i1", "item_type": "free", "description": "x", "qty": 1, "unit_price": 1, "discount": 0, "line_net": 1, "section_id": "s1"}],
        workspace={"name": "W"},
        customer=None,
        site=None,
        status="sent",
        sections=[{"id": "s1", "name": "סעיף", "sort_order": 1}],
        branding={"logo_url": None},
    )
    assert snap["public"]["sections"][0]["name"] == "סעיף"
    assert snap["sections"][0]["id"] == "s1"
    assert snap["public"]["signature"]["mode"] == "signature_pad_v1"
