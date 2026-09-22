#!/usr/bin/env python3
"""Generate Docs/PRODUCT_FULL_INVENTORY.md from live repo tree. No secrets."""
from __future__ import annotations

import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "Docs" / "PRODUCT_FULL_INVENTORY.md"


def rel(p: Path) -> str:
    return p.relative_to(ROOT).as_posix()


def extract_api_endpoints() -> list[tuple[str, str, str, str]]:
    rows: list[tuple[str, str, str, str]] = []
    routers = ROOT / "apps/api/app/routers"
    for f in sorted(routers.glob("*.py")):
        text = f.read_text(encoding="utf-8", errors="replace")
        prefs = re.findall(r'APIRouter\([^)]*prefix\s*=\s*["\']([^"\']+)', text)
        prefix = prefs[0] if prefs else ""
        for m in re.finditer(
            r'@router\.(get|post|put|patch|delete)\(\s*["\']([^"\']+)',
            text,
            re.I,
        ):
            method, path = m.group(1).upper(), m.group(2)
            full = f"{prefix}{path}" if path.startswith("/") else f"{prefix}/{path}"
            rows.append((f.name, method, full, prefix))
    return rows


def extract_tables() -> dict[str, tuple[str, list[str]]]:
    tables: dict[str, tuple[str, list[str]]] = {}
    mig_dir = ROOT / "supabase/migrations"
    for f in sorted(mig_dir.glob("*.sql")):
        text = f.read_text(encoding="utf-8", errors="replace")
        for m in re.finditer(
            r"CREATE TABLE(?: IF NOT EXISTS)?\s+(?:public\.)?(\w+)\s*\((.*?)\);",
            text,
            re.S | re.I,
        ):
            name = m.group(1)
            cols: list[str] = []
            for line in m.group(2).splitlines():
                line = line.strip().rstrip(",")
                if not line or line.startswith("--"):
                    continue
                up = line.upper()
                if up.startswith(
                    ("CONSTRAINT", "PRIMARY", "UNIQUE", "FOREIGN", "CHECK", "EXCLUDE")
                ):
                    continue
                cm = re.match(r"(\w+)\s+(.+)", line)
                if cm:
                    cols.append(f"{cm.group(1)} — {cm.group(2)[:120]}")
            tables[name] = (f.name, cols)
    return tables


def list_tree(base: Path, patterns: list[str]) -> list[str]:
    out: list[str] = []
    for pat in patterns:
        out.extend(rel(p) for p in sorted(base.glob(pat)) if p.is_file())
    return out


def main() -> None:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines: list[str] = []
    a = lines.append

    a("# SITE SECURE — מלאי מלא שנוצר מהקוד")
    a("")
    a(f"**נוצר אוטומטית:** {now}")
    a("**מקור:** סריקת ריפו חיה — לא ידני")
    a("**מסמך אח (סטטוס + איך עובד):** `Docs/PRODUCT_STATUS_UNIFIED.md`")
    a("")
    a("> מסמך זה נועד למלא פרטים שחסרו במסמך הסטטוס: כל endpoint, כל טבלה+עמודות, כל הרשאה, כל קובץ מסלול/רכיב/סקריפט/טסט/מיגרציה/תיעוד.")
    a("")
    a("---")
    a("")

    # Catalog
    cat_path = ROOT / "packages/authz/catalog.json"
    cat = json.loads(cat_path.read_text(encoding="utf-8-sig"))
    a("## 1. Authz catalog — תפקידים")
    a("")
    for r in cat.get("roles", []):
        if isinstance(r, dict):
            a(f"- `{r.get('key')}` — {r.get('label_he') or r.get('label_en') or ''}")
    a("")
    a("## 2. Authz catalog — כל ההרשאות (71)")
    a("")
    a("| key | label_he |")
    a("|-----|----------|")
    for p in cat.get("permissions", []):
        a(f"| `{p.get('key')}` | {p.get('label_he') or ''} |")
    a("")
    a("## 3. Authz catalog — features")
    a("")
    for f in cat.get("features", []):
        if isinstance(f, dict):
            a(f"- `{f.get('key')}` — {f.get('label_he') or f.get('label_en') or ''}")
        else:
            a(f"- `{f}`")
    a("")
    a("## 4. Authz catalog — grants לפי תפקיד")
    a("")
    for role, grants in (cat.get("grants") or {}).items():
        if grants == ["*"]:
            a(f"### `{role}` → `*` (הכל)")
        else:
            a(f"### `{role}` ({len(grants)})")
            for g in grants:
                a(f"- `{g}`")
        a("")
    a("## 5. Authz catalog — plans")
    a("")
    plans = cat.get("plans") or {}
    if isinstance(plans, dict):
        for k in plans:
            a(f"- `{k}`")
    elif isinstance(plans, list):
        for p in plans:
            a(f"- `{p.get('key') if isinstance(p, dict) else p}`")
    a("")

    # API
    a("---")
    a("")
    a("## 6. API — כל ה־endpoints")
    a("")
    a("| router | method | path |")
    a("|--------|--------|------|")
    for fname, method, full, _pref in extract_api_endpoints():
        a(f"| `{fname}` | {method} | `{full}` |")
    a("")

    # Web routes
    a("---")
    a("")
    a("## 7. Web — כל קבצי ה־routes")
    a("")
    for p in list_tree(ROOT / "apps/web/src/routes", ["**/*.tsx", "**/*.ts"]):
        a(f"- `{p}`")
    a("")

    # Components
    a("---")
    a("")
    a("## 8. Web — כל הקומפוננטות")
    a("")
    for p in list_tree(ROOT / "apps/web/src/components", ["**/*.tsx", "**/*.ts"]):
        a(f"- `{p}`")
    a("")

    # Lib
    a("---")
    a("")
    a("## 9. Web — lib / i18n / hooks")
    a("")
    for base in ["apps/web/src/lib", "apps/web/src/i18n", "apps/web/src/hooks"]:
        d = ROOT / base
        if d.exists():
            for p in sorted(d.rglob("*")):
                if p.is_file() and p.suffix in {".ts", ".tsx", ".json", ".css"}:
                    a(f"- `{rel(p)}`")
    a("")

    # API app modules
    a("---")
    a("")
    a("## 10. API — כל מודולי Python תחת app/")
    a("")
    for p in sorted((ROOT / "apps/api/app").rglob("*.py")):
        a(f"- `{rel(p)}`")
    a("")

    # Tables
    a("---")
    a("")
    a("## 11. Database — כל הטבלאות והעמודות (מ־CREATE TABLE)")
    a("")
    tables = extract_tables()
    a(f"**סה״כ טבלאות שחולצו:** {len(tables)}")
    a("")
    for name, (mig, cols) in sorted(tables.items()):
        a(f"### `{name}`")
        a(f"מיגרציה: `{mig}`")
        a("")
        for c in cols:
            a(f"- {c}")
        a("")

    # Migrations list
    a("---")
    a("")
    a("## 12. כל קבצי המיגרציות")
    a("")
    for p in sorted((ROOT / "supabase/migrations").glob("*.sql")):
        a(f"- `{p.name}`")
    a("")

    # Scripts & tests
    a("---")
    a("")
    a("## 13. API scripts")
    a("")
    scripts = ROOT / "apps/api/scripts"
    if scripts.exists():
        for p in sorted(scripts.rglob("*.py")):
            a(f"- `{rel(p)}`")
    a("")
    a("## 14. API tests")
    a("")
    tests = ROOT / "apps/api/tests"
    if tests.exists():
        for p in sorted(tests.rglob("*.py")):
            a(f"- `{rel(p)}`")
    a("")

    # Packages
    a("---")
    a("")
    a("## 15. packages/ — קבצים")
    a("")
    for p in sorted((ROOT / "packages").rglob("*")):
        if p.is_file() and "node_modules" not in p.parts and p.suffix not in {".map"}:
            if p.suffix in {".ts", ".tsx", ".json", ".css", ".md", ".toml"} or p.name in {
                "package.json",
                "README.md",
            }:
                a(f"- `{rel(p)}`")
    a("")

    # Docs
    a("---")
    a("")
    a("## 16. Docs/ — כל המסמכים")
    a("")
    for p in sorted((ROOT / "Docs").rglob("*.md")):
        a(f"- `{rel(p)}`")
    a("")

    # Deploy
    a("---")
    a("")
    a("## 17. Deploy / config files")
    a("")
    for pattern in [
        "render.yaml",
        "vercel.json",
        "package.json",
        "deploy/*",
        "supabase/config.toml",
        ".env.example",
        "apps/web/package.json",
        "apps/api/pyproject.toml",
        "apps/web/vite.config.ts",
        "apps/web/tsconfig.json",
    ]:
        for p in sorted(ROOT.glob(pattern)):
            if p.is_file():
                a(f"- `{rel(p)}`")
    a("")

    # Explicit absences
    a("---")
    a("")
    a("## 18. מה שאין בריפו (נבדק)")
    a("")
    absences = [
        ("apps/mobile", "אפליקציית Expo"),
        ("leaflet/mapbox בקוד", "ספריות מפות"),
        ("router ל־patrol/shifts/stripe", "מוצרי V3/תשלום"),
    ]
    a(f"- `apps/mobile` קיים? **{(ROOT / 'apps/mobile').exists()}**")
    # quick greps
    web_src = ROOT / "apps/web/src"
    api_src = ROOT / "apps/api/app"
    blob = ""
    for folder in (web_src, api_src):
        for p in folder.rglob("*"):
            if p.suffix in {".ts", ".tsx", ".py"} and p.is_file():
                try:
                    blob += p.read_text(encoding="utf-8", errors="ignore")
                except OSError:
                    pass
    for term in ("leaflet", "mapbox", "MapContainer", "geofence", "stripe", "patrol_checkpoint"):
        a(f"- מופעי `{term}` בקוד web+api: **{blob.lower().count(term.lower())}**")
    a("")
    a("## 19. הערת שלמות")
    a("")
    a("המלאי כולל כל קובץ route/component/lib, כל endpoint מעוטר, כל CREATE TABLE שחולץ ממיגרציות,")
    a("כל הרשאה בקטלוג, כל מיגרציה/סקריפט/טסט/מסמך. לא כולל: תוכן מלא של כל פונקציה, node_modules,")
    a("קבצי build, גיבויי vault, סודות `.env`.")
    a("")
    a("**סוף מלאי.**")
    a("")

    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"WROTE {OUT} lines={len(lines)}")
    # Merge into the single unified product doc (deletes this intermediate file).
    from _merge_product_docs import main as merge_main

    merge_main()


if __name__ == "__main__":
    main()
