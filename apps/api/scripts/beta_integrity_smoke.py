"""Critical integrity smoke against clean beta-0.1.1 candidate (local)."""
from __future__ import annotations

import json
import os
import time
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx
from dotenv import load_dotenv
from openpyxl import Workbook

ROOT = Path(__file__).resolve().parents[3]
load_dotenv(ROOT / ".env")
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

API = os.environ.get("API_URL", "http://127.0.0.1:8010").rstrip("/")
WEB = os.environ.get("WEB_URL", "http://localhost:5173").rstrip("/")
SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
ANON = os.environ["SUPABASE_ANON_KEY"]
SERVICE = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
RUN = uuid.uuid4().hex[:8]
EMAIL = f"beta.integrity.{RUN}@sitesecure.test"
PASSWORD = f"BetaInteg-{RUN}-2026!"
OUT = Path(__file__).resolve().parent / "_beta_integrity"
OUT.mkdir(exist_ok=True)
checks: list[tuple[str, bool, str]] = []


def ck(name: str, ok: bool, detail: str = "") -> None:
    checks.append((name, ok, detail[:300]))
    print(("PASS" if ok else "FAIL"), name, detail[:180])


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def admin_headers() -> dict[str, str]:
    return {"apikey": SERVICE, "Authorization": f"Bearer {SERVICE}", "Content-Type": "application/json"}


def password_grant(email: str, password: str) -> str | None:
    with httpx.Client(timeout=45) as c:
        r = c.post(
            f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
            headers={"apikey": ANON, "Content-Type": "application/json"},
            json={"email": email, "password": password},
        )
    return r.json().get("access_token") if r.status_code == 200 else None


def confirm(email: str, password: str) -> None:
    with httpx.Client(timeout=45) as c:
        listed = c.get(f"{SUPABASE_URL}/auth/v1/admin/users", headers=admin_headers(), params={"page": 1, "per_page": 200})
        uid = None
        if listed.status_code == 200:
            for u in listed.json().get("users") or []:
                if (u.get("email") or "").lower() == email.lower():
                    uid = u.get("id")
                    break
        if uid:
            c.put(f"{SUPABASE_URL}/auth/v1/admin/users/{uid}", headers=admin_headers(), json={"email_confirm": True, "password": password})
        else:
            c.post(
                f"{SUPABASE_URL}/auth/v1/admin/users",
                headers=admin_headers(),
                json={"email": email, "password": password, "email_confirm": True},
            )


def xlsx(path: Path, n: int = 320) -> None:
    wb = Workbook()
    ws = wb.active
    ws.title = "IPC"
    ws.append(["SKU", "Model", "מחיר מתקין", "Description"])
    for i in range(1, n + 1):
        ws.append([f"INT-{RUN}-{i:04d}", f"M-{i}", 100 + (i % 5) * 10, f"Product {i}"])
    wb.save(path)


def main() -> int:
    with httpx.Client(timeout=180) as c:
        fe = c.get(WEB)
        health = c.get(f"{API}/health").json()
        ck("env_fe_api", fe.status_code == 200 and health.get("ok") is True, f"fe={fe.status_code}")

        c.post(
            f"{SUPABASE_URL}/auth/v1/signup",
            headers={"apikey": ANON, "Content-Type": "application/json"},
            json={"email": EMAIL, "password": PASSWORD, "data": {"full_name": f"Integrity {RUN}"}},
        )
        confirm(EMAIL, PASSWORD)
        tok = password_grant(EMAIL, PASSWORD)
        ck("register_login", bool(tok), EMAIL)
        if not tok:
            return _finish()

        ws = c.post(f"{API}/api/v1/workspaces", headers=auth(tok), json={"name": f"Integrity WS {RUN}", "business_type": "security_installer"})
        ck("workspace", ws.status_code in {200, 201}, str(ws.status_code))
        ws_id = str(ws.json()["id"])

        products0 = c.get(f"{API}/api/v1/workspaces/{ws_id}/catalog/products", headers=auth(tok), params={"limit": 50})
        ck("golden_empty", products0.status_code == 200 and len((products0.json() or {}).get("items") or []) == 0, str(products0.status_code))

        dash = c.get(f"{API}/api/v1/workspaces/{ws_id}/dashboard", headers=auth(tok))
        ck("dashboard", dash.status_code == 200, str(dash.status_code))

        c.post(f"{API}/api/v1/workspaces/{ws_id}/catalog/ensure-defaults", headers=auth(tok), json={})
        cats = c.get(f"{API}/api/v1/workspaces/{ws_id}/catalog/categories", headers=auth(tok)).json()
        cat_list = cats if isinstance(cats, list) else (cats or {}).get("items") or []
        leaf = next((x for x in cat_list if x.get("parent_id")), cat_list[0])
        path = OUT / f"scale_{RUN}.xlsx"
        xlsx(path, 320)
        with path.open("rb") as fh:
            parsed = c.post(
                f"{API}/api/v1/workspaces/{ws_id}/catalog/import/parse",
                headers={"Authorization": f"Bearer {tok}"},
                files={"file": (path.name, fh, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            ).json()
        sid = parsed["session_id"]
        sheets = parsed.get("sheets") or []
        cfgs = []
        for s in sheets:
            cmap = {str(k): str(v) for k, v in (s.get("suggested_map") or {}).items() if v}
            if "name" not in cmap.values() and "description" in cmap.values():
                for k, v in list(cmap.items()):
                    if v == "description":
                        cmap[k] = "name"
            cfgs.append(
                {
                    "sheet_index": s["index"],
                    "include": True,
                    "header_row": s.get("header_row"),
                    "category_id": str(leaf["id"]),
                    "manufacturer_default": "INT",
                    "column_map": cmap,
                }
            )
        commit = c.post(
            f"{API}/api/v1/workspaces/{ws_id}/catalog/import/commit",
            headers=auth(tok),
            json={"session_id": sid, "duplicate_policy": "skip", "sheets": cfgs, "confirm": True},
        )
        summary = (commit.json() or {}).get("summary") or {}
        page = c.get(f"{API}/api/v1/workspaces/{ws_id}/catalog/products", headers=auth(tok), params={"limit": 100})
        bad = c.get(f"{API}/api/v1/workspaces/{ws_id}/catalog/products", headers=auth(tok), params={"limit": 1000})
        search = c.get(f"{API}/api/v1/workspaces/{ws_id}/catalog/products", headers=auth(tok), params={"limit": 50, "q": "INT-"})
        items = (page.json() or {}).get("items") or []
        ck(
            "catalog_import_list",
            commit.status_code == 200 and len(items) > 0 and bad.status_code == 400 and search.status_code == 200 and len((search.json() or {}).get("items") or []) > 0,
            f"commit={commit.status_code} created={summary.get('will_create')} list100={len(items)} limit1000={bad.status_code} search={len((search.json() or {}).get('items') or [])}",
        )

        bp = c.post(
            f"{API}/api/v1/workspaces/{ws_id}/catalog/products/bulk-pricing",
            headers=auth(tok),
            json={"mode": "markup_percent", "value": 30, "only_missing_list_price": True, "dry_run": False, "limit": 50},
        )
        ck("bulk_pricing", bp.status_code == 200 and int((bp.json() or {}).get("updated") or 0) > 0, str(bp.json())[:120])

        cust = c.post(f"{API}/api/v1/workspaces/{ws_id}/customers", headers=auth(tok), json={"display_name": f"Cust {RUN}", "phone": "0501112233"})
        cust_id = cust.json()["id"]
        site = c.post(
            f"{API}/api/v1/workspaces/{ws_id}/sites",
            headers=auth(tok),
            json={"customer_id": cust_id, "name": f"Site {RUN}", "address": {"line": "1", "city": "TLV", "formatted": "1 TLV"}},
        )
        site_id = site.json()["id"]
        ck("customer_site", cust.status_code in {200, 201} and site.status_code in {200, 201}, "")

        # CCTV products
        cats2 = {x.get("key"): x for x in cat_list}
        for sku, name, key, attrs, price in [
            ("CAM-INT", "Cam", "cameras_ip", {"resolution_mp": 4, "form_factor": "dome", "environment": "outdoor", "poe": True, "max_power_w": 8}, 450),
            ("NVR-INT", "NVR", "nvr", {"channels": 8, "poe_ports": 8, "poe_budget_w": 120, "drive_bays": 2, "max_hdd_tb": 16}, 1800),
            ("HDD-INT", "HDD", "hdd_recorders", {"capacity_tb": 4, "surveillance_grade": True}, 400),
            ("SW-INT", "SW", "poe_plus", {"ports": 8, "poe_ports": 8, "poe_budget_w": 120, "port_speed_mbps": 1000}, 900),
        ]:
            if key in cats2:
                c.post(
                    f"{API}/api/v1/workspaces/{ws_id}/catalog/products",
                    headers=auth(tok),
                    json={
                        "sku": sku,
                        "name": name,
                        "category_id": cats2[key]["id"],
                        "list_price": price,
                        "cost": price / 2,
                        "manufacturer": "INT",
                        "model": sku,
                        "unit": "unit",
                        "kind": "product",
                        "attributes": attrs,
                    },
                )

        q = c.post(
            f"{API}/api/v1/workspaces/{ws_id}/quotes",
            headers=auth(tok),
            json={
                "customer_id": cust_id,
                "site_id": site_id,
                "title": f"Quote {RUN}",
                "vat_percent": 18,
                "valid_until": (datetime.now(UTC) + timedelta(days=30)).date().isoformat(),
                "payment_terms": "net 30",
            },
        )
        qid = q.json()["id"]
        priced = [
            p
            for p in (c.get(f"{API}/api/v1/workspaces/{ws_id}/catalog/products", headers=auth(tok), params={"limit": 50, "q": "INT-"}).json() or {}).get("items") or []
            if float(p.get("list_price") or 0) > 0
        ][:2]
        for p in priced:
            c.post(
                f"{API}/api/v1/workspaces/{ws_id}/quotes/{qid}/items",
                headers=auth(tok),
                json={"product_id": p["id"], "item_type": "catalog", "qty": 1, "unit_price": float(p["list_price"]), "name": p.get("name"), "sku": p.get("sku")},
            )

        obsolete = c.post(f"{API}/api/v1/workspaces/{ws_id}/quotes/{qid}/apply-cctv", headers=auth(tok), json={})
        rec = c.post(
            f"{API}/api/v1/workspaces/{ws_id}/cctv/recommend",
            headers=auth(tok),
            json={"camera_count": 4, "resolution_mp": 4, "retention_days": 14, "poe_required": True},
        )
        data = rec.json() if rec.status_code == 200 else {}
        lines = []
        for comp in data.get("components") or []:
            sel = comp.get("selected_product")
            if sel and comp.get("selected_confidence") != "TEXT_ASSISTED":
                lines.append({"product_id": sel["id"], "qty": float(comp.get("quantity") or 1), "role": comp.get("role")})
        sec = c.post(f"{API}/api/v1/workspaces/{ws_id}/quotes/{qid}/sections", headers=auth(tok), json={"name": "CCTV", "sort_order": 10}).json()
        section_id = (sec.get("section") or {}).get("id") or (sec.get("sections") or [{}])[-1].get("id")
        applied = 0
        for line in lines:
            item = c.post(
                f"{API}/api/v1/workspaces/{ws_id}/quotes/{qid}/items",
                headers=auth(tok),
                json={"product_id": line["product_id"], "item_type": "catalog", "qty": line["qty"], "section_id": section_id},
            )
            if item.status_code == 200:
                applied += 1
        full = c.get(f"{API}/api/v1/workspaces/{ws_id}/quotes/{qid}", headers=auth(tok)).json()
        ck(
            "cctv_apply_to_quote",
            obsolete.status_code == 404 and rec.status_code == 200 and applied >= 3 and len(full.get("items") or []) >= applied,
            f"obsolete={obsolete.status_code} rec={rec.status_code} applied={applied} items={len(full.get('items') or [])} blocking={data.get('blocking')}",
        )

        pdf = c.get(f"{API}/api/v1/workspaces/{ws_id}/quotes/{qid}/pdf", headers=auth(tok))
        if pdf.status_code != 200:
            pdf = c.post(f"{API}/api/v1/workspaces/{ws_id}/quotes/{qid}/pdf", headers=auth(tok), json={})
        ck("pdf", pdf.status_code == 200 and pdf.content[:4] == b"%PDF", f"status={pdf.status_code} bytes={len(pdf.content)}")

        # approve → project
        c.post(f"{API}/api/v1/workspaces/{ws_id}/quotes/{qid}/send", headers=auth(tok), json={})
        share = c.post(f"{API}/api/v1/workspaces/{ws_id}/quotes/{qid}/share", headers=auth(tok), json={})
        token = (share.json() or {}).get("public_token")
        png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
        if token:
            c.post(
                f"{API}/api/v1/public/quotes/{token}/approve",
                json={"name": "QA", "terms_accepted": True, "signature_data_url": f"data:image/png;base64,{png}"},
            )
        proj = c.post(f"{API}/api/v1/workspaces/{ws_id}/projects/from-quote", headers=auth(tok), json={"source_quote_id": qid, "site_id": site_id})
        ck("quote_to_project", proj.status_code in {200, 201}, f"{proj.status_code} {proj.text[:120]}")
        project_id = str(proj.json()["id"]) if proj.status_code in {200, 201} else None

        job = c.post(
            f"{API}/api/v1/workspaces/{ws_id}/jobs",
            headers=auth(tok),
            json={
                "title": f"Job {RUN}",
                "customer_id": cust_id,
                "site_id": site_id,
                "kind": "installation",
                "scheduled_for": (datetime.now(UTC) + timedelta(hours=1)).isoformat(),
                "project_id": project_id,
            },
        )
        job_id = str(job.json()["id"]) if job.status_code in {200, 201} else None
        start = c.post(f"{API}/api/v1/workspaces/{ws_id}/jobs/{job_id}/start", headers=auth(tok), json={}) if job_id else None
        cl = c.get(f"{API}/api/v1/workspaces/{ws_id}/jobs/{job_id}/checklist", headers=auth(tok)) if job_id else None
        jpeg = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9"
        up = (
            c.post(
                f"{API}/api/v1/workspaces/{ws_id}/documents/uploads",
                headers=auth(tok),
                json={"entity_type": "job", "entity_id": job_id, "kind": "photo", "mime_type": "image/jpeg", "original_filename": "a.jpg", "byte_size": len(jpeg)},
            )
            if job_id
            else None
        )
        today = c.get(f"{API}/api/v1/workspaces/{ws_id}/dashboard", headers=auth(tok))
        ck(
            "today_field_photo",
            bool(job_id) and getattr(start, "status_code", 0) == 200 and getattr(cl, "status_code", 0) == 200 and getattr(up, "status_code", 0) in {200, 201} and today.status_code == 200,
            f"job={job_id} start={getattr(start,'status_code',None)} cl={getattr(cl,'status_code',None)} up={getattr(up,'status_code',None)}",
        )

        admin_deny = c.get(f"{API}/api/v1/admin/users", headers=auth(tok))
        ck("platform_admin_denial", admin_deny.status_code in {401, 403}, str(admin_deny.status_code))

    return _finish()


def _finish() -> int:
    report = {"checks": [{"name": n, "ok": ok, "detail": d} for n, ok, d in checks], "failed": [n for n, ok, _ in checks if not ok]}
    (OUT / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("FAILED", report["failed"] or "none")
    return 1 if report["failed"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
