"""Catalog import API — parse / preview / commit / template (workspace-scoped)."""

from __future__ import annotations

from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field

from ..authz.engine import authorize
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
from ..rest import as_list, created_or_403, patched_or_403
from ..routers.catalog import PRODUCT_SELECT, _can_view_cost, _category_index, _load_categories, _strip_cost

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}/catalog/import", tags=["catalog-import"])


def _ctx(client: UserClient, user: dict, workspace_id: UUID):
    return load_authz_context(client, user=user, workspace_id=workspace_id)


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
    candidates, summary, cat_index = _run_preview(
        client=client, workspace_id=workspace_id, body=body, can_set_cost=can_cost
    )
    # Sample up to 40 rows for UI
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
    # Estimated readiness from products that would be written
    est_products = [
        c["product"]
        for c in candidates
        if c["status"] != "blocked" and c.get("duplicate_action") in {"create", "update"}
    ]
    readiness = readiness_from_products(est_products, cat_index)
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
    # If any sheet maps cost and user cannot view cost → still allow but cost forced 0
    candidates, summary, cat_index = _run_preview(
        client=client, workspace_id=workspace_id, body=body, can_set_cost=can_cost
    )

    imported = 0
    updated = 0
    skipped = 0
    failed: list[dict[str, Any]] = []
    written_products: list[dict[str, Any]] = []

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
            skipped += 1
            continue
        product = dict(c["product"])
        if not can_cost:
            product["cost"] = 0
        try:
            if action == "update":
                pid = c.get("existing_id")
                if not pid:
                    skipped += 1
                    continue
                patch = {
                    "name": product["name"],
                    "description": product.get("description") or "",
                    "unit": product.get("unit") or "unit",
                    "list_price": product.get("list_price") or 0,
                    "manufacturer": product.get("manufacturer"),
                    "model": product.get("model"),
                    "category_id": product.get("category_id"),
                    "attributes": product.get("attributes") or {},
                    "is_active": True,
                }
                if can_cost:
                    patch["cost"] = product.get("cost") or 0
                row = patched_or_403(
                    client.patch(
                        "products",
                        patch,
                        params={"id": f"eq.{pid}", "workspace_id": f"eq.{workspace_id}"},
                    )
                )
                updated += 1
                written_products.append(row if isinstance(row, dict) else product)
            else:
                payload = {
                    "workspace_id": str(workspace_id),
                    "sku": product["sku"],
                    "name": product["name"],
                    "description": product.get("description") or "",
                    "unit": product.get("unit") or "unit",
                    "kind": "product",
                    "list_price": product.get("list_price") or 0,
                    "cost": (product.get("cost") or 0) if can_cost else 0,
                    "vat_eligible": True,
                    "is_labor": False,
                    "is_active": True,
                    "manufacturer": product.get("manufacturer"),
                    "model": product.get("model"),
                    "attributes": product.get("attributes") or {},
                }
                if product.get("category_id"):
                    payload["category_id"] = product["category_id"]
                row = created_or_403(client.post("products", payload))
                if isinstance(row, list):
                    row = row[0] if row else payload
                imported += 1
                written_products.append(row if isinstance(row, dict) else payload)
        except Exception as exc:  # noqa: BLE001
            failed.append(
                {
                    "sku": product.get("sku"),
                    "source_row": c.get("source_row"),
                    "sheet_name": c.get("sheet_name"),
                    "reasons": [str(exc)[:200]],
                }
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
        + (f", {len(failed)} נכשלו" if failed else ""),
    }
