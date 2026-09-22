"""One-shot: import external quote #500 into existing CPQ via authenticated API."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[3]
load_dotenv(ROOT / ".env")
load_dotenv(ROOT / "apps" / "api" / ".env")

WS = "f1f76d59-fd2e-4b27-9586-06f7c89abc9c"
CUSTOMER_ID = "1e8b86cf-d7d1-4283-a2b4-f861e9b2ae88"
API = os.environ.get("API_PUBLIC_URL", "http://127.0.0.1:8000").rstrip("/")
TOKEN = (Path(__file__).resolve().parent / ".tmp_import_token").read_text(encoding="utf-8").strip()

WARRANTY = (
    "שנה אחריות מלאה על כל המוצרים למעט נזק ונדליזם, כל עוד הקריאה היא עקב תקלה במערכת. "
    "שנה שנייה והלאה: 400 ₪ כולל מע״מ לשעת עבודה של טכנאי + עלות חלקים במידת הצורך. "
    "במידה וטכנאי שלא מטעמנו מתעסק במערכת — האחריות מוסרת."
)

GENERAL_TERMS = (
    "במקרה של ביטול ההזמנה לאחר אישורה — דמי ביטול 20% מסכום העסקה. "
    "לאחר תחילת עבודת המתקין לא ניתן לבטל את העסקה. "
    "עבודות נוספות מעבר להזמנה יתומחרו בנפרד. "
    "באחריות הלקוח/ועד הבניין לספק אינטרנט תקין לצפייה מרחוק ונקודת חשמל קרובה. "
    "כל הציוד שייך לספק עד לסילוק מלא של התשלום."
)

PAYMENT_TERMS = (
    "40% בעת סגירת ההזמנה (3,400 ₪ לפני מע״מ); "
    "60% בגמר העבודה (5,100 ₪ לפני מע״מ). "
    "עודכן מול הלקוח (לא 50/50 מהמסמך המקורי)."
)

INTERNAL_NOTES = (
    "ייבוא מהצעת מחיר חיצונית מס׳ 500 מתאריך 25/08/2026. "
    "לקוח במסמך: איליה / פניקס — קושר ללקוח הקיים «איליה קרנר». "
    "מבנה תמחור כבמסמך: ציוד במחיר 0, התקנה+חיווט+הגדרות 8,500 ₪. "
    "SKU בקטלוג: DS-7616NXI-2T, 8 POE, DS-2CD1043G2-LIU2.8 — לא נמצאו; "
    "שורות ציוד הוזנו כשורות חופשיות ללא יצירת פריטי קטלוג חדשים."
)

LINES = [
    {
        "description": "מערכת הקלטה Hikvision 16 ערוצים כולל 2TB (SKU: DS-7616NXI-2T)",
        "qty": 1,
        "unit_price": 0,
        "item_type": "free",
        "sort_order": 10,
        "sku_label": "DS-7616NXI-2T",
    },
    {
        "description": "סוויץ' 8 POE לטובת המצלמות (SKU: 8 POE)",
        "qty": 1,
        "unit_price": 0,
        "item_type": "free",
        "sort_order": 20,
        "sku_label": "8 POE",
    },
    {
        "description": "מצלמת צינור Hikvision 4MP עם מיקרופון (SKU: DS-2CD1043G2-LIU2.8)",
        "qty": 7,
        "unit_price": 0,
        "item_type": "free",
        "sort_order": 30,
        "sku_label": "DS-2CD1043G2-LIU2.8",
    },
    {
        "description": "קופסאות הגבהה מקוריות לפי צורך",
        "qty": 1,
        "unit_price": 0,
        "item_type": "free",
        "sort_order": 40,
        "sku_label": None,
    },
    {
        "description": "התקנה + חיווט + הגדרות",
        "qty": 1,
        "unit_price": 8500,
        "item_type": "labor",
        "sort_order": 50,
        "sku_label": None,
    },
]


def api(method: str, path: str, body: dict | None = None) -> dict:
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json",
    }
    with httpx.Client(timeout=60) as client:
        res = client.request(method, f"{API}{path}", headers=headers, json=body)
    if res.status_code >= 400:
        raise SystemExit(f"{method} {path} -> {res.status_code}: {res.text}")
    return res.json() if res.content else {}


def main() -> None:
    create = api(
        "POST",
        f"/api/v1/workspaces/{WS}/quotes",
        {
            "customer_id": CUSTOMER_ID,
            "title": "מערכת מצלמות מקיפה לבית",
            "project_name": "מערכת מצלמות מקיפה לבית",
            "summary": "הצעת מחיר חיצונית מס׳ 500 — מערכת מצלמות לבית",
            "vat_percent": 18,
            "discount_type": "amount",
            "discount_value": 0,
            "valid_until": "2026-09-01",
            "payment_terms": PAYMENT_TERMS,
            "warranty": WARRANTY,
            "general_terms": GENERAL_TERMS,
            "internal_notes": INTERNAL_NOTES,
            "customer_notes": "תוקף: 7 ימים ממועד שליחת ההצעה.",
            "key_points": (
                "תשלום 40/60 (סגירה / גמר עבודה). "
                "מקור: הצעת מחיר חיצונית מס׳ 500 מתאריך 25/08/2026."
            ),
        },
    )
    quote_id = create["id"]
    print("created_quote", create.get("number"), quote_id)

    sectioned = api(
        "POST",
        f"/api/v1/workspaces/{WS}/quotes/{quote_id}/sections",
        {"name": "מערכת מצלמות", "sort_order": 10},
    )
    section = sectioned.get("section") or {}
    section_id = section.get("id")
    if not section_id:
        raise SystemExit(f"missing section in response: {json.dumps(sectioned, ensure_ascii=False)[:500]}")
    print("section", section_id)

    for line in LINES:
        payload = {
            "description": line["description"],
            "qty": line["qty"],
            "unit_price": line["unit_price"],
            "item_type": line["item_type"],
            "sort_order": line["sort_order"],
            "discount": 0,
            "discount_type": "amount",
            "section_id": section_id,
        }
        out = api("POST", f"/api/v1/workspaces/{WS}/quotes/{quote_id}/items", payload)
        print("line", line["sort_order"], "subtotal", out.get("subtotal_net"), "total", out.get("total_gross"))

    final = api("GET", f"/api/v1/workspaces/{WS}/quotes/{quote_id}")
    result = {
        "quote_id": final["id"],
        "number": final.get("number"),
        "customer_id": final.get("customer_id"),
        "site_id": final.get("site_id"),
        "lead_id": final.get("lead_id"),
        "section_id": section_id,
        "line_count": len(final.get("items") or []),
        "subtotal_net": final.get("subtotal_net"),
        "vat_amount": final.get("vat_amount"),
        "total_gross": final.get("total_gross"),
        "payment_terms": final.get("payment_terms"),
        "items": [
            {
                "description": i.get("description"),
                "qty": i.get("qty"),
                "unit_price": i.get("unit_price"),
                "line_net": i.get("line_net"),
                "item_type": i.get("item_type"),
                "product_id": i.get("product_id"),
                "sku": i.get("sku"),
            }
            for i in (final.get("items") or [])
        ],
    }
    out_path = Path(__file__).resolve().parent / ".tmp_import_result.json"
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
