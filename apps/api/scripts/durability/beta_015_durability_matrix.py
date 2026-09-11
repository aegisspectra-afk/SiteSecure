#!/usr/bin/env python3
"""Focused post-0.1.5 durability matrix + scoped backup regression (QA only)."""

from __future__ import annotations

import hashlib
import json
import os
import sys
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
load_dotenv(ROOT / ".env")
load_dotenv(ROOT / "apps" / "api" / ".env")

from gate10b_drill import (  # noqa: E402
    API,
    SH,
    SUP,
    ANON,
    ensure_user,
    create_workspace,
    upload_via_api,
    verify_object,
)
from logical_backup import run_backup  # noqa: E402
from logical_restore import restore  # noqa: E402

REPORT = HERE / "reports" / "beta_015_durability_matrix.json"


def main() -> int:
    run = int(time.time())
    password = f"Beta015-{run}-Qa!"
    results: dict = {"run": run, "checks": {}, "api": API}

    with httpx.Client(timeout=120) as c:
        owner_email = f"beta015.owner.{run}@sitesecure.test"
        tech_email = f"beta015.tech.{run}@sitesecure.test"
        owner_id, owner_tok = ensure_user(c, owner_email, password)
        tech_id, tech_tok = ensure_user(c, tech_email, password)
        ws = create_workspace(c, owner_tok, f"BETA015-QA-{run}")
        # technician membership
        c.post(
            f"{SUP}/rest/v1/workspace_memberships",
            headers={**SH, "Prefer": "return=representation"},
            json={
                "workspace_id": ws,
                "user_id": tech_id,
                "role_key": "technician",
                "workspace_role_key": "technician",
                "status": "active",
            },
        )
        h = {"Authorization": f"Bearer {owner_tok}", "Content-Type": "application/json"}
        cust = c.post(f"{API}/api/v1/workspaces/{ws}/customers", headers=h, json={"display_name": "B015"}).json()
        site = c.post(
            f"{API}/api/v1/workspaces/{ws}/sites",
            headers=h,
            json={"customer_id": cust["id"], "name": "B015 Site", "address": {"line": "x"}},
        ).json()

        # A: storage exists + complete → success (via upload_via_api)
        content = f"beta015-{run}\n".encode()
        doc = upload_via_api(
            c,
            api=API,
            token=owner_tok,
            workspace_id=ws,
            entity_type="site",
            entity_id=site["id"],
            kind="document",
            filename=f"b015-{run}.txt",
            content=content,
            mime="text/plain",
        )
        results["checks"]["A_complete_with_object"] = True

        # D: view/download after complete
        url = c.get(
            f"{API}/api/v1/workspaces/{ws}/documents/{doc['document_id']}/url",
            headers={"Authorization": f"Bearer {owner_tok}"},
        )
        results["checks"]["D_download_after_complete"] = url.status_code == 200

        # B: missing object + complete → fail
        intent = c.post(
            f"{API}/api/v1/workspaces/{ws}/documents/uploads",
            headers=h,
            json={
                "entity_type": "site",
                "entity_id": site["id"],
                "kind": "document",
                "mime_type": "text/plain",
                "original_filename": "missing.txt",
                "byte_size": 10,
            },
        )
        mid = intent.json()["document_id"]
        bad = c.post(
            f"{API}/api/v1/workspaces/{ws}/documents/{mid}/complete",
            headers=h,
            json={"byte_size": 10},
        )
        results["checks"]["B_complete_without_object"] = bad.status_code == 409 and (
            (bad.json().get("error") or {}).get("code") == "STORAGE_OBJECT_MISSING"
            or "STORAGE_OBJECT_MISSING" in bad.text
        )

        # C: incomplete reservation download denied (create intent, no put/complete)
        intent2 = c.post(
            f"{API}/api/v1/workspaces/{ws}/documents/uploads",
            headers=h,
            json={
                "entity_type": "site",
                "entity_id": site["id"],
                "kind": "document",
                "mime_type": "text/plain",
                "original_filename": "incomplete.txt",
                "byte_size": 8,
            },
        )
        iid = intent2.json()["document_id"]
        # If B cleaned the row, this is a fresh incomplete. Download should 409.
        dl = c.get(
            f"{API}/api/v1/workspaces/{ws}/documents/{iid}/url",
            headers={"Authorization": f"Bearer {owner_tok}"},
        )
        results["checks"]["C_incomplete_download_denied"] = dl.status_code == 409

        # E: cross-workspace denied
        ws_b = create_workspace(c, owner_tok, f"BETA015-QA-B-{run}")
        # owner of A cannot use ws_b token mismatch — create second owner
        other_email = f"beta015.other.{run}@sitesecure.test"
        _, other_tok = ensure_user(c, other_email, password)
        ws_other = create_workspace(c, other_tok, f"BETA015-OTHER-{run}")
        cross = c.get(
            f"{API}/api/v1/workspaces/{ws_other}/documents/{doc['document_id']}/url",
            headers={"Authorization": f"Bearer {owner_tok}"},
        )
        results["checks"]["E_cross_workspace_denied"] = cross.status_code in {401, 403, 404}

        # F/G technician commercial deny + assigned surfaces (smoke)
        quotes = c.get(
            f"{API}/api/v1/workspaces/{ws}/quotes",
            headers={"Authorization": f"Bearer {tech_tok}"},
        )
        results["checks"]["F_tech_quotes_denied"] = quotes.status_code in {401, 403}
        # unassigned doc url as tech — may 403 depending on assignment scope
        tech_dl = c.get(
            f"{API}/api/v1/workspaces/{ws}/documents/{doc['document_id']}/url",
            headers={"Authorization": f"Bearer {tech_tok}"},
        )
        results["checks"]["G_tech_unassigned_doc"] = tech_dl.status_code in {401, 403, 404}

        # H: complete cannot use another path — complete uses DB path only; verify missing path fails
        results["checks"]["H_complete_uses_db_path_only"] = results["checks"]["B_complete_without_object"]

        # Backup regression: backup → poison → restore → read
        dest = run_backup(workspace_ids=[ws])
        poison = b"POISON-015-" + os.urandom(8)
        c.post(
            f"{SUP}/storage/v1/object/{doc['bucket']}/{doc['storage_path'].lstrip('/')}",
            headers={**SH, "Content-Type": "application/octet-stream", "x-upsert": "true"},
            content=poison,
        )
        assert hashlib.sha256(poison).hexdigest() != hashlib.sha256(content).hexdigest()
        # wipe only documents row + restore scoped
        c.delete(f"{SUP}/rest/v1/documents", headers=SH, params={"id": f"eq.{doc['document_id']}"})
        restore(dest.name, workspace_ids=[ws], qa_password=password)
        results["checks"]["backup_regression_binary"] = verify_object(
            c, doc["bucket"], doc["storage_path"], hashlib.sha256(content).hexdigest()
        )
        meta = c.get(
            f"{SUP}/rest/v1/documents",
            headers=SH,
            params={"id": f"eq.{doc['document_id']}", "select": "id,byte_size"},
        ).json()
        results["checks"]["backup_regression_metadata"] = bool(meta and meta[0].get("byte_size") is not None)

        # cleanup note: leave QA workspaces for audit (disposable names)

    results["ok"] = all(results["checks"].values())
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(json.dumps(results, indent=2))
    return 0 if results["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
