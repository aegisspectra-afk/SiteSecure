#!/usr/bin/env python3
"""Merge PRODUCT_STATUS_UNIFIED + PRODUCT_FULL_INVENTORY into one file."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
STATUS = ROOT / "Docs" / "PRODUCT_STATUS_UNIFIED.md"
INV = ROOT / "Docs" / "PRODUCT_FULL_INVENTORY.md"


def main() -> None:
    status = STATUS.read_text(encoding="utf-8")
    if INV.exists():
        inv = INV.read_text(encoding="utf-8")
    else:
        # regenerate inventory first
        import subprocess
        import sys

        gen = ROOT / "apps/api/scripts/_generate_full_inventory_md.py"
        subprocess.check_call([sys.executable, str(gen)], cwd=str(ROOT))
        inv = INV.read_text(encoding="utf-8")

    # Keep status from "# חלק א" onward, but drop any previous appendices block
    marker = "# חלק א"
    idx = status.find(marker)
    if idx == -1:
        raise SystemExit("status missing חלק א")
    status_body = status[idx:]
    for appendix_marker in ("# נספחים", "## 1. Authz catalog"):
        # If appendices already embedded after חלק sections, cut them off before re-merge.
        # Prefer cutting at "# נספחים" if present.
        pass
    cut = status_body.find("\n# נספחים")
    if cut != -1:
        status_body = status_body[:cut]
    else:
        # legacy: inventory sections glued without נספחים header
        cut2 = status_body.find("\n## 1. Authz catalog")
        if cut2 != -1:
            status_body = status_body[:cut2]

    # Fix docs index table if dual refs remain
    status_body = status_body.replace(
        "| **סטטוס + איך עובד** | `Docs/PRODUCT_STATUS_UNIFIED.md` |\n"
        "| **מלאי מלא בלי חסר (endpoints/טבלאות/קבצים)** | `Docs/PRODUCT_FULL_INVENTORY.md` |",
        "| **המסמך האחיד (הכל בקובץ זה)** | `Docs/PRODUCT_STATUS_UNIFIED.md` |",
    )
    status_body = status_body.replace(
        "| **המסמך הזה (הכל במקום אחד)** | `Docs/PRODUCT_STATUS_UNIFIED.md` |",
        "| **המסמך האחיד (הכל בקובץ זה)** | `Docs/PRODUCT_STATUS_UNIFIED.md` |",
    )

    inv_marker = "## 1. Authz catalog"
    iidx = inv.find(inv_marker)
    if iidx == -1:
        raise SystemExit("inventory missing section 1")
    inv_body = inv[iidx:]

    header = """# SITE SECURE — מסמך מוצר אחיד מלא

**מטרה:** מסמך **אחד בלבד** — סטטוס, איך זה עובד, כל המסכים, כל ה-API, כל הטבלאות והעמודות, כל ההרשאות, כל הקבצים.
**תאריך:** 2026-09-13
**גרסת Web חיה:** `0.1.6-beta`
**מקור אמת:** הקוד החי בריפו
**פריסה:** Web → Vercel · API → Render · DB/Auth/Storage → Supabase

אין מסמך משני. הכל כאן.

רענון המלאי האוטומטי מתוך הקוד (מייצר וממזג חזרה לקובץ זה):
```bash
python apps/api/scripts/_generate_full_inventory_md.py
```

> לא נכלל במסמך: גוף כל פונקציה, `node_modules`, build artifacts, `_backup_vault`, סודות `.env`.

---

"""

    merged = (
        header
        + status_body.strip()
        + "\n\n---\n\n# נספחים — מלאי מלא מהקוד\n\n"
        + inv_body.strip()
        + "\n"
    )
    STATUS.write_text(merged, encoding="utf-8")
    INV.unlink(missing_ok=True)
    print(f"WROTE {STATUS} lines={merged.count(chr(10)) + 1}")
    print(f"DELETED separate inventory: {not INV.exists()}")


if __name__ == "__main__":
    main()
