"""AUDIT ONLY helper — generates inventory artifacts. Does not modify application code."""
from __future__ import annotations

import csv
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent


def extract_endpoints() -> list[dict]:
    routers = ROOT / "apps/api/app/routers"
    main = (ROOT / "apps/api/app/main.py").read_text(encoding="utf-8")
    included = set(re.findall(r"include_router\((\w+)\.router\)", main))
    rows: list[dict] = []
    for f in sorted(routers.glob("*.py")):
        text = f.read_text(encoding="utf-8", errors="replace")
        prefix_m = re.search(r"APIRouter\([^)]*prefix\s*=\s*['\"]([^'\"]+)['\"]", text)
        prefix = prefix_m.group(1) if prefix_m else ""
        mod = f.stem
        wired = "yes" if mod in included else "NO"
        for m in re.finditer(
            r"@router\.(get|post|put|patch|delete)\(\s*['\"]([^'\"]*)['\"]", text
        ):
            method, path = m.group(1).upper(), m.group(2)
            if path:
                full = (prefix.rstrip("/") + "/" + path.lstrip("/")).replace("//", "/")
            else:
                full = prefix
            if full and not full.startswith("/"):
                full = "/" + full
            line = text[: m.start()].count("\n") + 1
            rows.append(
                {
                    "file": f"apps/api/app/routers/{f.name}",
                    "module": mod,
                    "wired_in_main": wired,
                    "method": method,
                    "path": full or "/",
                    "line": line,
                }
            )
    print("ENDPOINTS", len(rows))
    print("WIRED", sorted(included))
    print("UNWIRED", sorted({r["module"] for r in rows if r["wired_in_main"] == "NO"}))
    (OUT / "_api_endpoints.json").write_text(json.dumps(rows, indent=2), encoding="utf-8")
    return rows


def extract_db_types() -> None:
    db = (ROOT / "packages/types/src/database.ts").read_text(encoding="utf-8")
    idx = db.find("Tables: {")
    idx2 = db.find("Views: {")
    idx3 = db.find("Functions: {")
    idx4 = db.find("Enums: {")
    sect = db[idx : idx2 if idx2 > 0 else idx3]
    tables = re.findall(r"^\s{6}([a-z_][a-z0-9_]*):\s*\{", sect, re.M)
    print("TABLES", len(tables))
    (OUT / "_tables.json").write_text(json.dumps(tables, indent=2), encoding="utf-8")
    fsect = db[idx3:idx4]
    funcs = re.findall(r"^\s{6}([a-z_][a-z0-9_]*):\s*\{", fsect, re.M)
    print("FUNCS", len(funcs))
    (OUT / "_rpcs.json").write_text(json.dumps(funcs, indent=2), encoding="utf-8")
    esect = db[idx4:]
    enums = re.findall(r"^\s{6}([a-z_][a-z0-9_]*):", esect, re.M)
    (OUT / "_enums.json").write_text(json.dumps(enums, indent=2), encoding="utf-8")
    print("ENUMS", len(enums))


def classify(rel: str) -> tuple[str, str, str, str]:
    parts = rel.split("/")
    ext = Path(rel).suffix.lower()
    top = parts[0] if parts else ""
    module = top
    if top == "apps" and len(parts) > 1:
        module = f"apps/{parts[1]}"
    if top == "packages" and len(parts) > 1:
        module = f"packages/{parts[1]}"
    ftype = "other"
    if ext in {".ts", ".tsx", ".js", ".mjs"}:
        ftype = "frontend_source" if ("apps/web" in rel or "packages/" in rel) else "script"
    if ext == ".py":
        ftype = "backend_source"
    if ext == ".sql":
        ftype = "sql"
    if ext == ".md":
        ftype = "documentation"
    if ext in {".json", ".yaml", ".yml", ".toml"}:
        ftype = "config"
    if ext in {".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"}:
        ftype = "asset_image"
    if ext == ".pdf":
        ftype = "document_pdf"
    if ext == ".css":
        ftype = "stylesheet"
    if ".env" in Path(rel).name:
        ftype = "env"
    if "tests/" in rel or "/test_" in Path(rel).name or rel.endswith(".test.ts") or rel.endswith(".test.tsx"):
        ftype = "test"
    importance = "medium"
    critical_markers = (
        "main.py",
        "catalog.json",
        "database.ts",
        "deps.py",
        "migrations/",
        "authz",
        "__root",
        "session",
    )
    if any(x in rel for x in critical_markers):
        importance = "critical"
    if ftype in {"documentation", "asset_image", "document_pdf"}:
        importance = "low"
    usage = "unknown"
    if ftype == "test":
        usage = "test"
    if ftype == "documentation":
        usage = "docs"
    if ftype == "asset_image":
        usage = "asset"
    if "routers/" in rel:
        usage = "api_router"
    if "/routes/" in rel:
        usage = "frontend_route"
    return module, ftype, importance, usage


def enrich_inventory() -> int:
    raw_path = ROOT / "_audit_inventory_raw.csv"
    raw = list(csv.DictReader(raw_path.open(encoding="utf-8-sig")))
    outp = OUT / "FILE_INVENTORY.csv"
    fields = [
        "RelativePath",
        "FileName",
        "Extension",
        "FileType",
        "SizeBytes",
        "InGit",
        "LocalGitStatus",
        "Module",
        "Importance",
        "UsageIdentified",
        "Scanned",
        "DocumentationStatus",
        "Notes",
    ]
    count = 0
    with outp.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for row in raw:
            rel = row["RelativePath"]
            if "/._" in "/" + rel or rel.startswith("._") or Path(rel).name.startswith("._"):
                continue
            module, ftype, imp, usage = classify(rel)
            notes = ""
            if row.get("InGit") == "no" and ftype == "env":
                notes = "local env present; secret values not documented"
            w.writerow(
                {
                    "RelativePath": rel,
                    "FileName": row["FileName"],
                    "Extension": row["Extension"],
                    "FileType": ftype,
                    "SizeBytes": row["SizeBytes"],
                    "InGit": row["InGit"],
                    "LocalGitStatus": row.get("LocalGitStatus", ""),
                    "Module": module,
                    "Importance": imp,
                    "UsageIdentified": usage,
                    "Scanned": "indexed",
                    "DocumentationStatus": "inventory_listed",
                    "Notes": notes,
                }
            )
            count += 1
    print("INVENTORY_ROWS", count)
    return count


def write_api_reference(rows: list[dict]) -> None:
    lines = [
        "# API REFERENCE — SITE SECURE",
        "",
        "**Generated from static decorator scan of** `apps/api/app/routers/*.py` **on 2026-10-02.**",
        "",
        f"**Total endpoints found:** {len(rows)}",
        "",
        f"**Mounted in** `main.py`**:** {sum(1 for e in rows if e['wired_in_main'] == 'yes')}",
        "",
        f"**Present but NOT mounted:** {sum(1 for e in rows if e['wired_in_main'] == 'NO')}",
        "",
        "OpenAPI at runtime: `/api/openapi.json` (when API running) — **NOT fetched live in this audit.**",
        "",
        "Auth: most workspace routes require Bearer JWT + membership; health and public quote token routes are exceptions. Exact dependencies are per-handler.",
        "",
        "## Endpoint table",
        "",
        "| Wired | Method | Path | Source |",
        "|-------|--------|------|--------|",
    ]
    for e in rows:
        lines.append(
            f"| {e['wired_in_main']} | {e['method']} | `{e['path']}` | `{e['file']}:{e['line']}` |"
        )
    lines += [
        "",
        "## Unwired modules (AUDIT-001)",
        "",
        "- `connections` — asset topology",
        "- `customer_portal` — portal admin + accept/session",
        "- `ipam` — VLANs/networks/IPs",
        "",
        "Unit tests may call router functions directly; that does **not** prove HTTP mount.",
        "",
        "### Verification status",
        "",
        "Wired=yes → IMPLEMENTED — NOT FULLY VERIFIED (runtime). Wired=NO → BACKEND ONLY / NOT MOUNTED.",
    ]
    (OUT / "API_REFERENCE.md").write_text("\n".join(lines), encoding="utf-8")


def write_exclusions() -> None:
    exclusions = [
        {
            "path": "node_modules/",
            "reason": "Installed npm dependencies; regenerated by package manager",
            "impact": "Dependency versions taken from package-lock.json / package.json only",
        },
        {
            "path": ".git/",
            "reason": "Git object store",
            "impact": "History available via git commands; pack has AppleDouble ._*.idx noise",
        },
        {
            "path": "**/dist/",
            "reason": "Build artifacts",
            "impact": "Runtime deploy uses built assets; source of truth is src/",
        },
        {
            "path": "**/.venv/",
            "reason": "Python virtualenv",
            "impact": "API deps from pyproject.toml",
        },
        {
            "path": "**/.pytest_cache/",
            "reason": "Test cache",
            "impact": "None for architecture",
        },
        {
            "path": "**/.ruff_cache/",
            "reason": "Linter cache",
            "impact": "None",
        },
        {
            "path": "**/.tanstack/",
            "reason": "TanStack router plugin cache",
            "impact": "Generated route tree also in src/routeTree.gen.ts",
        },
        {
            "path": ".vercel/",
            "reason": "Vercel local project metadata",
            "impact": "Deploy config from vercel.json",
        },
        {
            "path": ".cache/",
            "reason": "Tooling cache",
            "impact": "None",
        },
        {
            "path": ".external-reference/",
            "reason": "External reference material; not primary product source",
            "impact": "Not treated as runtime product code in this audit",
        },
        {
            "path": "_backup_vault/",
            "reason": "Backup archive",
            "impact": "Excluded from primary inventory content review",
        },
        {
            "path": "_qa_local_archive/",
            "reason": "Local QA archive",
            "impact": "Excluded from primary inventory",
        },
        {
            "path": "Fintech App UI/",
            "reason": "Design reference extract",
            "impact": "Design inspiration only; not runtime",
        },
        {
            "path": "lottiefiles/",
            "reason": "Large animation assets",
            "impact": "Asset presence noted; binary content not analyzed",
        },
        {
            "path": "Images/",
            "reason": "Large image assets folder",
            "impact": "Asset presence noted; binary content not analyzed",
        },
        {
            "path": "**/._*",
            "reason": "macOS AppleDouble resource forks (pollution from cross-platform copy)",
            "impact": "Causes git pack index warnings; not product code",
        },
        {
            "path": "Docs/**/qa/** and Docs/*-qa/",
            "reason": "Large historical QA snapshot trees (many PNGs) — indexed at folder level",
            "impact": "PNG binaries counted in inventory when under Docs/; content not OCR'd",
        },
    ]
    (OUT / "_exclusions.json").write_text(json.dumps(exclusions, indent=2), encoding="utf-8")


if __name__ == "__main__":
    rows = extract_endpoints()
    extract_db_types()
    enrich_inventory()
    write_exclusions()
    write_api_reference(rows)
    print("DONE")
