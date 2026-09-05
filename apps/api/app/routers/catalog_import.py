"""Catalog import API — parse / preview / commit / template (workspace-scoped)."""

from __future__ import annotations

from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field

from ..authz.guard import require
from ..catalog_import.engine import (
    classify_duplicates,
    collect_candidates,
    readiness_from_products,
    summarize_candidates,
)
from ..catalog_import.mapping import TARGET_FIELDS, suggest_category_key
from ..catalog_import.parse import MAX_FILE_BYTES, parse_upload
from ..catalog_import.session import get_import_session_store
from ..catalog_import.template import build_import_template_bytes
from ..deps import UserClient, current_user, load_authz_context, user_client
from ..errors import ApiError
from ..identity import actor_id
from ..rest import as_list
from ..routers.catalog import PRODUCT_SELECT, _can_view_cost, _category_index, _load_categories

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}/catalog/import", tags=["catalog-import"])


def _ctx(client: UserClient, user: dict, workspace_id: UUID):
    return load_authz_context(client, actor_id(user), str(workspace_id))


class SheetConfigIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    sheet_index: int
    include: bool = True
    header_row: int | None = None
    category_id: str | None = None
    manufacturer_default: str | None = None
    unit_default: str = "unit"
    column_map: dict[str, str] = Field(default_factory=dict)


class ImportPreviewIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    session_id: str
    duplicate_policy: Literal["skip", "update", "new_only"] = "skip"
    sheets: list[SheetConfigIn]


class ImportCommitIn(ImportPreviewIn):
    confirm: bool = False
    # Test hook: forces mid-transaction failure so the RPC rolls back all writes.
    test_force_fail: bool = False


def _public_sheets(sheets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for s in sheets:
        out.append(
            {
                "index": s["index"],
                "name": s["name"],
                "row_count": s["row_count"],
                "suggested_include": s["suggested_include"],
                "header_row": s["header_row"],
                "header_confidence": s["header_confidence"],
                "headers": s["headers"],
                "suggested_map": s["suggested_map"],
                "suggested_category_key": suggest_category_key(s["name"]),
                "preview_rows": s.get("preview_rows") or [],
            }
        )
    return out


def _existing_sku_map(client: UserClient, workspace_id: UUID) -> dict[str, str]:
    rows = as_list(
        client.get(
            "products",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "select": "id,sku",
                "limit": "10000",
            },
        )
    )
    return {str(r["sku"]): str(r["id"]) for r in rows if r.get("sku")}


def _run_preview(
    *,
    client: UserClient,
    workspace_id: UUID,
    body: ImportPreviewIn,
    can_set_cost: bool,
) -> tuple[list[dict[str, Any]], dict[str, Any], dict[str, dict]]:
    store = get_import_session_store()
    session = store.get(body.session_id, workspace_id=str(workspace_id))
    if not session:
        raise ApiError(404, "NOT_FOUND", "סשן הייבוא לא נמצא או שפג תוקפו — העלו מחדש")

    cats = _load_categories(client, workspace_id, include_archived=False)
    cat_index = _category_index(cats)
    sheet_cfgs = [s.model_dump() for s in body.sheets]
    candidates = collect_candidates(
        session.sheets,
        sheet_cfgs,
        categories_by_id=cat_index,
        can_set_cost=can_set_cost,
    )
    existing = _existing_sku_map(client, workspace_id)
    classify_duplicates(candidates, existing, body.duplicate_policy)
    summary = summarize_candidates(candidates)
    return candidates, summary, cat_index


def _candidate_rpc_rows(
    candidates: list[dict[str, Any]],
    *,
    can_cost: bool,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Build atomic RPC payload. Blocked rows are excluded from the transaction."""
    rows: list[dict[str, Any]] = []
    failed: list[dict[str, Any]] = []
    for c in candidates:
        action = c.get("duplicate_action")
        if c["status"] == "blocked":
            failed.append(
                {
                    "sku": (c.get("product") or {}).get("sku"),
                    "source_row": c.get("source_row"),
                    "sheet_name": c.get("sheet_name"),
                    "reasons": c.get("block_reasons") or [],
                }
            )
            continue
        if action == "skip":
            rows.append({"action": "skip", "sku": (c.get("product") or {}).get("sku")})
            continue
        product = dict(c["product"])
        if not can_cost:
            product["cost"] = 0
        row: dict[str, Any] = {
            "action": "update" if action == "update" else "create",
            "sku": product["sku"],
            "name": product["name"],
            "description": product.get("description") or "",
            "unit": product.get("unit") or "unit",
            "kind": "product",
            "list_price": product.get("list_price") or 0,
            "cost": product.get("cost") or 0,
            "vat_eligible": True,
            "is_active": True,
            "manufacturer": product.get("manufacturer"),
            "model": product.get("model"),
            "category_id": product.get("category_id"),
            "attributes": product.get("attributes") or {},
        }
        if action == "update":
            if not c.get("existing_id"):
                rows.append({"action": "skip", "sku": product.get("sku")})
                continue
            row["existing_id"] = c["existing_id"]
        rows.append(row)
    return rows, failed


@router.get("/targets")
def import_targets(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "catalog.view")
    return {
        "fields": TARGET_FIELDS,
        "duplicate_policies": ["skip", "update", "new_only"],
        "max_file_bytes": MAX_FILE_BYTES,
        "pricing_note_he": "מחיר מתקין / עלות ספק יש למפות לשדה עלות (cost). מחיר מכירה ללקוח הוא list_price — אל תמפו עלות ספק למחיר מכירה אוטומטית.",
        "google_sheets_note_he": "Google Sheets: הורידו כקובץ Excel או CSV והעלו לכאן. חיבור ישיר ל-Google Sheets אינו זמין בגרסה זו.",
        "file_lifetime_he": "הקובץ נשמר זמנית בזיכרון השרת עד 30 דקות או עד סיום הייבוא, ואינו נשמר בקטלוג גלובלי.",
    }


@router.get("/template")
def download_template(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "catalog.view")
    data = build_import_template_bytes()
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": 'attachment; filename="site-secure-catalog-import-template.xlsx"'
        },
    )


@router.post("/parse")
async def parse_catalog_file(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    file: UploadFile = File(...),
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "catalog.edit")

    raw = await file.read()
    try:
        parsed = parse_upload(raw, filename=file.filename or "upload.xlsx", content_type=file.content_type)
    except ValueError as exc:
        code = str(exc)
        messages = {
            "FILE_TOO_LARGE": "הקובץ גדול מדי (מקסימום 12MB)",
            "EMPTY_FILE": "הקובץ ריק",
            "UNSUPPORTED_TYPE": "נתמכים רק קבצי XLSX או CSV",
            "PARSE_FAILED": "לא ניתן לקרוא את הקובץ",
            "ENCODING": "קידוד הקובץ לא נתמך",
        }
        raise ApiError(400, "VALIDATION_ERROR", messages.get(code, "קובץ לא תקין"), details={"code": code}) from exc

    store = get_import_session_store()
    session = store.create(
        workspace_id=str(workspace_id),
        user_id=actor_id(user),
        filename=parsed["filename"],
        format=parsed["format"],
        sheets=parsed["sheets"],
    )
    return {
        "session_id": session.id,
        "filename": session.filename,
        "format": session.format,
        "sheet_count": len(session.sheets),
        "sheets": _public_sheets(session.sheets),
        "expires_in_seconds": 30 * 60,
        "pricing_note_he": "מחיר מתקין יש למפות לעלות (cost), לא למחיר מכירה.",
    }


@router.post("/preview")
def preview_import(
    workspace_id: UUID,
    body: ImportPreviewIn,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "catalog.edit")
    can_cost = _can_view_cost(ctx)
    candidates, summary, _cat_index = _run_preview(
        client=client, workspace_id=workspace_id, body=body, can_set_cost=can_cost
    )
    sample = []
    for c in candidates[:40]:
        sample.append(
            {
                "sheet_name": c.get("sheet_name"),
                "source_row": c.get("source_row"),
                "status": c["status"],
                "warnings": c.get("warnings") or [],
                "block_reasons": c.get("block_reasons") or [],
                "is_duplicate": bool(c.get("is_duplicate")),
                "duplicate_action": c.get("duplicate_action"),
                "original": c.get("original") or {},
                "product": c.get("product"),
                "provenance": c.get("provenance") or {},
            }
        )
    est_products = [
        c["product"]
        for c in candidates
        if c["status"] != "blocked" and c.get("duplicate_action") in {"create", "update"}
    ]
    readiness = readiness_from_products(est_products, _cat_index)
    return {
        "summary": summary,
        "sample_rows": sample,
        "readiness_estimate": readiness,
        "can_view_cost": can_cost,
    }


@router.post("/commit")
def commit_import(
    workspace_id: UUID,
    body: ImportCommitIn,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "catalog.edit")
    if not body.confirm:
        raise ApiError(400, "VALIDATION_ERROR", "יש לאשר ייבוא במפורש")

    can_cost = _can_view_cost(ctx)
    candidates, summary, cat_index = _run_preview(
        client=client, workspace_id=workspace_id, body=body, can_set_cost=can_cost
    )
    rows, failed = _candidate_rpc_rows(candidates, can_cost=can_cost)

    rpc_rows = list(rows)
    if body.test_force_fail:
        rpc_rows.append(
            {
                "action": "create",
                "sku": "__FORCE_FAIL__",
                "name": "__FORCE_FAIL__",
                "_test_force_fail": True,
            }
        )

    if not rpc_rows:
        get_import_session_store().delete(body.session_id, workspace_id=str(workspace_id))
        return {
            "imported": 0,
            "updated": 0,
            "skipped": 0,
            "failed": failed,
            "failed_count": len(failed),
            "summary": summary,
            "readiness": readiness_from_products([], cat_index),
            "message_he": "לא יובאו מוצרים",
        }

    res = client.rpc(
        "catalog_import_commit",
        {"p_workspace_id": str(workspace_id), "p_rows": rpc_rows},
    )
    if res.status_code not in {200, 201}:
        # Keep session for retry — no partial writes from the RPC.
        detail = (res.text or "")[:400]
        raise ApiError(
            409,
            "IMPORT_COMMIT_FAILED",
            "הייבוא נכשל ולא נשמרו שינויים. ניתן לנסות שוב.",
            details={"status": res.status_code, "detail": detail},
        )

    result = res.json()
    if not isinstance(result, dict):
        result = {}
    imported = int(result.get("imported") or 0)
    updated = int(result.get("updated") or 0)
    skipped = int(result.get("skipped") or 0)

    product_ids = result.get("product_ids") or []
    written_products: list[dict[str, Any]] = []
    if product_ids:
        written_products = as_list(
            client.get(
                "products",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "id": f"in.({','.join(str(i) for i in product_ids)})",
                    "select": PRODUCT_SELECT,
                },
            )
        )

    readiness = readiness_from_products(written_products, cat_index)
    get_import_session_store().delete(body.session_id, workspace_id=str(workspace_id))

    return {
        "imported": imported,
        "updated": updated,
        "skipped": skipped,
        "failed": failed,
        "failed_count": len(failed),
        "summary": summary,
        "readiness": readiness,
        "message_he": f"{imported} מוצרים יובאו"
        + (f", {updated} עודכנו" if updated else "")
        + (f", {skipped} דולגו" if skipped else "")
        + (f", {len(failed)} נחסמו" if failed else ""),
    }
