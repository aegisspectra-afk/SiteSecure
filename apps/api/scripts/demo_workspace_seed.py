"""DEMO-6: idempotent seed for workspace «SITE SECURE – DEMO».

Creates (or refreshes) owner + manager + 2 technicians, customers/sites,
starter catalog SKUs, quotes in mixed statuses, projects, today's/tomorrow's
jobs, and one completed installation with a handover certificate token.

Safety:
  - Refuses APP_ENV=production
  - Prefers .env.demo.local (never commits secrets)
  - Does not send email; outbound stays preview-only by schema

Usage (after you fill .env.demo.local and apply migrations):

  python apps/api/scripts/demo_workspace_seed.py
  python apps/api/scripts/demo_workspace_seed.py --reset   # wipe demo entities then seed
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date, datetime, timedelta, timezone
from hashlib import sha256
from pathlib import Path
from urllib.parse import urlparse
import secrets

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[3]
load_dotenv(ROOT / ".env.demo.local")
load_dotenv(ROOT / ".env")
load_dotenv(ROOT / "apps" / "api" / ".env")

DEMO_NAME = "SITE SECURE – DEMO"
PASSWORD = os.environ.get("DEMO_PASSWORD") or "Demo-Pass-2026!"
APP_ENV = (os.environ.get("APP_ENV") or "development").strip().lower()
SUP = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
ANON = os.environ.get("SUPABASE_ANON_KEY") or ""
SERVICE = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
API = (os.environ.get("API_PUBLIC_URL") or os.environ.get("API_URL") or "http://127.0.0.1:8001").rstrip("/")
WEB = (os.environ.get("WEB_PUBLIC_URL") or "http://localhost:5173").rstrip("/")
REPORT = ROOT / "tmp" / "demo_workspace_seed_report.json"

USERS = [
    ("demo.owner@sitesecure.test", "owner", "נועה ברק"),
    ("demo.manager@sitesecure.test", "manager", "יואב מזרחי"),
    ("demo.tech1@sitesecure.test", "technician", "דניאל כהן"),
    ("demo.tech2@sitesecure.test", "technician", "מיכל לוי"),
]

CUSTOMERS = [
    ("אורן אלקטרוניקה בע״מ", "רחוב התעשייה 12", "ראשון לציון"),
    ("גן הילדים «שקד»", "שדרות הנשיא 8", "הרצליה"),
    ("מרפאת השיניים דר׳ שדה", "רחוב ביאליק 3", "פתח תקווה"),
    ("מלון הכרמל נוף", "שדרות הנשיאות 22", "חיפה"),
    ("משרדי עורכי דין גולן ושות׳", "דרך מנחם בגין 150", "תל אביב"),
    ("סופרמרקט רמת החייל", "רחוב הברזל 19", "תל אביב"),
    ("בית כנסת «אור חדש»", "רחוב יפו 45", "ירושלים"),
    ("מוסך הצפון בע״מ", "אזור תעשייה צפוני 7", "נתניה"),
]

CATALOG = [
    ("DEMO-CAM-4MP", "מצלמת IP 4MP דמו", "cameras_ip", 249.0, 120.0, "DemoVision", "DV-T4"),
    ("DEMO-NVR-8", "מקליט NVR 8 ערוצים דמו", "nvr", 980.0, 560.0, "DemoSecure", "DS-N8"),
    ("DEMO-POE-8", "מתג PoE 8 פורטים דמו", "poe", 289.0, 165.0, "DemoNet", "DN-P8"),
    ("DEMO-HDD-4TB", "כונן 4TB לניטור דמו", "hdd_recorders", 249.0, 148.0, "DemoSecure", "DS-H4"),
    ("DEMO-LABOR-INST", "התקנת מצלמה (שעת עבודה)", "labor", 180.0, 0.0, "SITE SECURE", "LABOR"),
]


def _die(msg: str) -> None:
    print(msg, file=sys.stderr)
    raise SystemExit(2)


def _guard() -> None:
    if APP_ENV == "production":
        _die("refusing DEMO seed in APP_ENV=production")
    if not SUP or not SERVICE or not ANON:
        _die("missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY (fill .env.demo.local)")
    host = urlparse(SUP).hostname or ""
    # Allow local or dedicated demo cloud project; never prod hostnames without DEMO_ALLOW_CLOUD=1
    if "supabase.co" in host and os.environ.get("DEMO_ALLOW_CLOUD") != "1":
        _die("cloud Supabase detected — set DEMO_ALLOW_CLOUD=1 only for the dedicated demo project")


def _svc(prefer: str | None = "return=representation") -> dict[str, str]:
    h = {
        "apikey": SERVICE,
        "Authorization": f"Bearer {SERVICE}",
        "Content-Type": "application/json",
    }
    if prefer:
        h["Prefer"] = prefer
    return h


def _get(path: str, params: dict | None = None) -> list:
    r = httpx.get(f"{SUP}/rest/v1/{path}", headers=_svc(None), params=params or {}, timeout=60)
    if r.status_code >= 400:
        _die(f"GET {path} failed {r.status_code}: {r.text[:400]}")
    data = r.json()
    return data if isinstance(data, list) else []


def _post(path: str, payload: dict | list) -> dict | list:
    r = httpx.post(f"{SUP}/rest/v1/{path}", headers=_svc(), json=payload, timeout=60)
    if r.status_code >= 400:
        _die(f"POST {path} failed {r.status_code}: {r.text[:500]}")
    data = r.json()
    if isinstance(data, list):
        return data[0] if data else {}
    return data if isinstance(data, dict) else {}


def _patch(path: str, params: dict, payload: dict) -> None:
    r = httpx.patch(
        f"{SUP}/rest/v1/{path}",
        headers={**_svc(None), "Prefer": "return=minimal"},
        params=params,
        json=payload,
        timeout=60,
    )
    if r.status_code >= 400:
        _die(f"PATCH {path} failed {r.status_code}: {r.text[:400]}")


def _rpc(name: str, payload: dict) -> object:
    r = httpx.post(f"{SUP}/rest/v1/rpc/{name}", headers=_svc(), json=payload, timeout=60)
    if r.status_code >= 400:
        _die(f"RPC {name} failed {r.status_code}: {r.text[:400]}")
    return r.json()


def ensure_user(email: str, password: str, full_name: str) -> str:
    with httpx.Client(timeout=60) as c:
        ah = {"apikey": SERVICE, "Authorization": f"Bearer {SERVICE}", "Content-Type": "application/json"}
        listed = c.get(f"{SUP}/auth/v1/admin/users", headers=ah, params={"page": 1, "per_page": 200}).json()
        uid = next(
            (u["id"] for u in (listed.get("users") or []) if (u.get("email") or "").lower() == email.lower()),
            None,
        )
        if uid:
            c.put(
                f"{SUP}/auth/v1/admin/users/{uid}",
                headers=ah,
                json={"email_confirm": True, "password": password, "user_metadata": {"full_name": full_name}},
            )
        else:
            created = c.post(
                f"{SUP}/auth/v1/admin/users",
                headers=ah,
                json={
                    "email": email,
                    "password": password,
                    "email_confirm": True,
                    "user_metadata": {"full_name": full_name},
                },
            )
            if created.status_code >= 400:
                _die(f"create user {email}: {created.status_code} {created.text[:300]}")
            uid = created.json().get("id")
        if not uid:
            _die(f"no uid for {email}")
        # profiles
        c.post(
            f"{SUP}/rest/v1/profiles",
            headers={**ah, "Prefer": "resolution=merge-duplicates,return=minimal"},
            json={"id": uid, "full_name": full_name, "email": email},
        )
        return str(uid)


def ensure_workspace() -> str:
    rows = _get("workspaces", {"name": f"eq.{DEMO_NAME}", "select": "id,name,is_demo", "limit": "1"})
    if rows:
        ws_id = str(rows[0]["id"])
        _patch("workspaces", {"id": f"eq.{ws_id}"}, {"is_demo": True, "status": "active"})
        return ws_id
    ws_id = _rpc("admin_provision_workspace", {"p_name": DEMO_NAME, "p_plan_key": "business"})
    if not isinstance(ws_id, str):
        _die(f"admin_provision_workspace unexpected: {ws_id!r}")
    _patch("workspaces", {"id": f"eq.{ws_id}"}, {"is_demo": True})
    return ws_id


def ensure_membership(workspace_id: str, user_id: str, role_key: str) -> None:
    existing = _get(
        "workspace_memberships",
        {
            "workspace_id": f"eq.{workspace_id}",
            "user_id": f"eq.{user_id}",
            "select": "user_id,status,role_key",
            "limit": "1",
        },
    )
    if existing:
        _patch(
            "workspace_memberships",
            {"workspace_id": f"eq.{workspace_id}", "user_id": f"eq.{user_id}"},
            {"status": "active", "role_key": role_key, "workspace_role_key": role_key},
        )
        return
    _post(
        "workspace_memberships",
        {
            "workspace_id": workspace_id,
            "user_id": user_id,
            "role_key": role_key,
            "workspace_role_key": role_key,
            "status": "active",
        },
    )


def disable_extra_products(workspace_id: str) -> None:
    for key in ("ssp", "workforce", "fleet"):
        httpx.post(
            f"{SUP}/rest/v1/workspace_feature_overrides?on_conflict=workspace_id,feature_key",
            headers={
                **_svc(None),
                "Prefer": "resolution=merge-duplicates,return=minimal",
            },
            json={"workspace_id": workspace_id, "feature_key": key, "enabled": False},
            timeout=30,
        ).raise_for_status()


def ensure_field_ops(workspace_id: str) -> None:
    rows = _get("workspaces", {"id": f"eq.{workspace_id}", "select": "field_ops", "limit": "1"})
    field_ops = rows[0].get("field_ops") if rows else {}
    if not isinstance(field_ops, dict):
        field_ops = {}
    field_ops["warranty_months"] = 12
    _patch("workspaces", {"id": f"eq.{workspace_id}"}, {"field_ops": field_ops})


def _ensure_category(workspace_id: str, key: str) -> str:
    rows = _get(
        "product_categories",
        {
            "workspace_id": f"eq.{workspace_id}",
            "key": f"eq.{key}",
            "select": "id",
            "archived_at": "is.null",
            "limit": "1",
        },
    )
    if rows:
        return str(rows[0]["id"])
    row = _post(
        "product_categories",
        {
            "workspace_id": workspace_id,
            "key": key,
            "name_he": key,
            "sort_order": 900,
        },
    )
    return str(row["id"])


def seed_catalog(workspace_id: str) -> list[str]:
    ids: list[str] = []
    for sku, name, category, sell, cost, mfr, model in CATALOG:
        category_id = _ensure_category(workspace_id, category)
        existing = _get(
            "products",
            {"workspace_id": f"eq.{workspace_id}", "sku": f"eq.{sku}", "select": "id", "limit": "1"},
        )
        payload = {
            "workspace_id": workspace_id,
            "sku": sku,
            "name": name,
            "category_id": category_id,
            "unit": "unit",
            "kind": "service" if category == "labor" else "product",
            "is_labor": category == "labor",
            "list_price": sell,
            "cost": cost,
            "vat_eligible": True,
            "is_active": True,
            "manufacturer": mfr,
            "model": model,
            "description": "פריט קטלוג לדמו — לא למכירה אמיתית",
            "attributes": {"demo": True},
        }
        if existing:
            _patch("products", {"id": f"eq.{existing[0]['id']}"}, payload)
            ids.append(str(existing[0]["id"]))
        else:
            row = _post("products", payload)
            ids.append(str(row.get("id")))
    return ids


def require_demo_workspace(workspace_id: str) -> dict:
    """Refuse destructive demo ops unless the workspace is flagged is_demo=true."""
    rows = _get(
        "workspaces",
        {"id": f"eq.{workspace_id}", "select": "id,name,is_demo", "limit": "1"},
    )
    if not rows:
        _die(f"workspace not found: {workspace_id}")
    row = rows[0]
    if row.get("is_demo") is not True:
        _die(
            f"refusing demo wipe/reset: workspace {workspace_id} is not is_demo=true "
            f"(name={row.get('name')!r})"
        )
    return row


def wipe_demo_entities(workspace_id: str) -> None:
    """Delete transactional demo rows (keeps memberships/products overrides)."""
    require_demo_workspace(workspace_id)
    # Order matters for FKs — best-effort.
    tables = [
        "handover_public_access",
        "outbound_messages",
        "billing_pending_items",
        "notifications",
        "job_checklist_items",
        "assignments",
        "documents",
        "warranties",
        "equipment",
        "project_planned_items",
        "jobs",
        "projects",
        "quote_items",
        "quote_sections",
        "quote_public_access",
        "quotes",
        "sites",
        "customers",
    ]
    for table in tables:
        r = httpx.delete(
            f"{SUP}/rest/v1/{table}",
            headers={**_svc(None), "Prefer": "return=minimal"},
            params={"workspace_id": f"eq.{workspace_id}"},
            timeout=120,
        )
        if r.status_code >= 400 and r.status_code != 404:
            print(f"warn wipe {table}: {r.status_code} {r.text[:160]}", flush=True)


def seed_customers_sites(workspace_id: str) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for i, (name, street, city) in enumerate(CUSTOMERS, start=1):
        cust = _post(
            "customers",
            {
                "workspace_id": workspace_id,
                "display_name": name,
                "type": "business",
                "status": "active",
                "email": f"contact{i}@example.invalid",
                "phone": f"050{1000000 + i}",
                "notes": "לקוח דמו — פרטים פיקטיביים",
            },
        )
        site = _post(
            "sites",
            {
                "workspace_id": workspace_id,
                "customer_id": cust["id"],
                "code": f"D{i:02d}",
                "name": f"אתר {name.split()[0]}",
                "address": {"line": street, "city": city, "country": "IL"},
                "installation_status": "planned",
            },
        )
        out.append((str(cust["id"]), str(site["id"])))
    return out


def seed_quotes(workspace_id: str, owner_id: str, pairs: list[tuple[str, str]]) -> list[str]:
    statuses = ["draft", "sent", "viewed", "approved", "rejected"]
    ids: list[str] = []
    for i, status in enumerate(statuses):
        cust_id, site_id = pairs[i]
        q = _post(
            "quotes",
            {
                "workspace_id": workspace_id,
                "customer_id": cust_id,
                "site_id": site_id,
                "owner_user_id": owner_id,
                "status": status,
                "currency": "ILS",
                "title": f"הצעת מחיר דמו — {status}",
                "project_name": f"פרויקט דמו {i + 1}",
                "subtotal_net": 10000 + i * 500,
                "total_gross": 11700 + i * 585,
                "version": 1,
            },
        )
        ids.append(str(q["id"]))
    return ids


def seed_projects_jobs(
    workspace_id: str,
    owner_id: str,
    tech1: str,
    tech2: str,
    pairs: list[tuple[str, str]],
    approved_quote_id: str | None,
) -> dict:
    today = datetime.now(timezone.utc).astimezone().date()
    projects = []
    for i in range(3):
        cust_id, site_id = pairs[i]
        p = _post(
            "projects",
            {
                "workspace_id": workspace_id,
                "customer_id": cust_id,
                "site_id": site_id,
                "name": f"מערכת מצלמות — {CUSTOMERS[i][0].split()[0]}",
                "status": "in_progress" if i < 2 else "planned",
                "source_quote_id": approved_quote_id if i == 0 else None,
            },
        )
        projects.append(p)
        # planned items for first project (handover equipment)
        if i == 0:
            _post(
                "project_planned_items",
                {
                    "workspace_id": workspace_id,
                    "project_id": p["id"],
                    "item_type": "catalog",
                    "scope_kind": "equipment",
                    "name": "מצלמת IP דמו",
                    "qty": 2,
                    "unit": "ea",
                    "is_optional": False,
                    "sort_order": 1,
                    "sku": "DEMO-CAM-4MP",
                    "manufacturer": "DemoVision",
                    "model": "DV-T4",
                    "source_quote_version": 1,
                    "description": "",
                },
            )

    def _job(title: str, project: dict, day: date, tech: str, status: str = "scheduled") -> dict:
        start = datetime.combine(day, datetime.min.time()).replace(tzinfo=timezone.utc) + timedelta(hours=7)
        job = _post(
            "jobs",
            {
                "workspace_id": workspace_id,
                "customer_id": project["customer_id"],
                "site_id": project["site_id"],
                "project_id": project["id"],
                "title": title,
                "kind": "installation",
                "status": status,
                "priority": "normal",
                "scheduled_for": start.isoformat(),
                "scheduled_end": (start + timedelta(hours=4)).isoformat(),
                "created_by": owner_id,
            },
        )
        _post(
            "assignments",
            {
                "workspace_id": workspace_id,
                "user_id": tech,
                "resource_type": "job",
                "resource_id": job["id"],
                "assigned_by": owner_id,
            },
        )
        return job

    jobs_today = [
        _job("התקנה — היום בוקר", projects[0], today, tech1),
        _job("התקנה — היום צהריים", projects[1], today, tech2),
    ]
    jobs_tomorrow = [
        _job("התקנה — מחר", projects[2], today + timedelta(days=1), tech1),
    ]

    # Completed job with warranty + handover (service-role, mirrors DEMO-5 tables)
    done = _job("התקנה שהושלמה — תעודת מסירה", projects[0], today - timedelta(days=1), tech1, status="completed")
    _patch(
        "jobs",
        {"id": f"eq.{done['id']}"},
        {
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "completed_by": tech1,
            "completion_notes": "התקנה הושלמה בדמו",
        },
    )
    war = _post(
        "warranties",
        {
            "workspace_id": workspace_id,
            "type": "installation",
            "status": "active",
            "customer_id": projects[0]["customer_id"],
            "site_id": projects[0]["site_id"],
            "starts_on": today.isoformat(),
            "ends_on": (today.replace(year=today.year + 1)).isoformat()
            if today.month != 2 or today.day != 29
            else date(today.year + 1, 2, 28).isoformat(),
            "job_id": done["id"],
            "title": "אחריות התקנה (דמו)",
            "policy": {"source": "demo_seed", "warranty_months": 12},
        },
    )
    # mint handover access (hash only — same as quote_tokens.hash_public_token)
    raw = secrets.token_urlsafe(32)
    digest = sha256(raw.encode("utf-8")).hexdigest()
    expires = datetime.now(timezone.utc) + timedelta(days=365 + 30)
    _post(
        "handover_public_access",
        {
            "workspace_id": workspace_id,
            "job_id": done["id"],
            "token_hash": digest,
            "expires_at": expires.isoformat(),
            "created_by": owner_id,
        },
    )
    # preview outbound only
    _post(
        "outbound_messages",
        {
            "workspace_id": workspace_id,
            "job_id": done["id"],
            "channel": "email",
            "status": "preview",
            "recipient": "contact1@example.invalid",
            "subject": "תעודת מסירה (דמו)",
            "body": f"קישור לתעודה: {WEB}/h/{raw}",
        },
    )
    _post(
        "notifications",
        {
            "workspace_id": workspace_id,
            "recipient_user_id": owner_id,
            "type": "job.completed",
            "title": "עבודה הושלמה (דמו)",
            "body": f"העבודה {done.get('number') or ''} הושלמה — תעודת מסירה מוכנה",
            "entity_type": "job",
            "entity_id": done["id"],
            "payload": {"handover_url": f"{WEB}/h/{raw}", "demo": True},
        },
    )

    return {
        "projects": [str(p["id"]) for p in projects],
        "jobs_today": [str(j["id"]) for j in jobs_today],
        "jobs_tomorrow": [str(j["id"]) for j in jobs_tomorrow],
        "completed_job_id": str(done["id"]),
        "warranty_id": str(war.get("id")),
        "handover_url": f"{WEB}/h/{raw}",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed SITE SECURE – DEMO workspace")
    parser.add_argument("--reset", action="store_true", help="Wipe demo transactional data then seed")
    args = parser.parse_args()
    _guard()

    print(f"DEMO seed → {DEMO_NAME}", flush=True)
    uids: dict[str, str] = {}
    for email, role, name in USERS:
        uids[email] = ensure_user(email, PASSWORD, name)
        print(f"  user {email} ({role})", flush=True)

    ws_id = ensure_workspace()
    print(f"  workspace {ws_id}", flush=True)
    if args.reset:
        print("  wiping transactional demo entities…", flush=True)
        wipe_demo_entities(ws_id)

    for email, role, _name in USERS:
        ensure_membership(ws_id, uids[email], role)
    disable_extra_products(ws_id)
    ensure_field_ops(ws_id)
    product_ids = seed_catalog(ws_id)
    pairs = seed_customers_sites(ws_id)
    quote_ids = seed_quotes(ws_id, uids["demo.owner@sitesecure.test"], pairs)
    approved = quote_ids[3] if len(quote_ids) > 3 else None
    chain = seed_projects_jobs(
        ws_id,
        uids["demo.owner@sitesecure.test"],
        uids["demo.tech1@sitesecure.test"],
        uids["demo.tech2@sitesecure.test"],
        pairs,
        approved,
    )

    report = {
        "workspace_id": ws_id,
        "workspace_name": DEMO_NAME,
        "users": {email: {"id": uids[email], "role": role} for email, role, _ in USERS},
        "password_env": "DEMO_PASSWORD",
        "product_ids": product_ids,
        "quote_ids": quote_ids,
        "customers_sites": [{"customer_id": c, "site_id": s} for c, s in pairs],
        **chain,
        "api": API,
        "web": WEB,
        "notes": [
            "outbound_messages remain status=preview only",
            "SSP/workforce/fleet disabled via workspace_feature_overrides",
            "is_demo=true shows demo banner and hides knowledge/portal UI",
        ],
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"ok": True, "workspace_id": ws_id, "handover_url": chain["handover_url"], "report": str(REPORT)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
