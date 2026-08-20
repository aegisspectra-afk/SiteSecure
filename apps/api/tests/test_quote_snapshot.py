from app.quote_snapshot import catalog_line_snapshot, public_items, public_payload


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
    }
    snap = catalog_line_snapshot(product)
    product["list_price"] = 9999
    assert snap["list_price"] == 1200
    assert snap["cost"] == 700
    assert snap["sku"] == "CAM-1"


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
