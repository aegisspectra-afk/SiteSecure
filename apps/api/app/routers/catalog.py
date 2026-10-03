from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from ..authz.engine import authorize
from ..authz.guard import require
from ..catalog_attrs import (
    AttributeValidationError,
    attribute_schema_for_category,
    normalize_unit,
    validate_product_attributes,
)
from ..deps import ServiceClient, UserClient, current_user, load_authz_context, service_client, user_client
from ..errors import ApiError
from ..identity import actor_id
from ..pagination import decode_cursor, encode_cursor
from ..rest import acked_or_403, as_list, created_or_403, one_or_404, patched_or_403

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}", tags=["catalog"])

_CURSOR_SEP = "\x1f"


def _pg_str(value: str) -> str:
    """Quote a PostgREST filter value so commas/parens in names stay safe."""
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def _decode_product_cursor(cursor: str | None) -> tuple[str, str] | None:
    raw = decode_cursor(cursor)
    if not raw:
        return None
    if _CURSOR_SEP in raw:
        name, product_id = raw.split(_CURSOR_SEP, 1)
        return name, product_id
    # Legacy name-only cursors from before keyset (name, id).
    return raw, ""


def _encode_product_cursor(row: dict) -> str | None:
    name = row.get("name")
    product_id = row.get("id")
    if name is None or not product_id:
        return None
    return encode_cursor(f"{name}{_CURSOR_SEP}{product_id}")


# Q4-S: authenticated cannot SELECT products.cost — never request it via UserClient JWT.
PRODUCT_SELECT = (
    "id,workspace_id,category_id,sku,name,description,unit,kind,list_price,"
    "vat_eligible,is_labor,is_active,manufacturer,model,attributes,created_at,updated_at"
)
PRODUCT_COST_SELECT = "id,cost"
CATEGORY_SELECT = "id,workspace_id,key,name_he,sort_order,parent_id,archived_at"
TEMPLATE_SELECT = "id,workspace_id,key,name_he,quote_template_items(count)"
COST_FIELDS = ("cost",)

KIND_TO_ITEM = {"service": "labor", "product": "catalog", "bundle": "catalog"}


def _category_keys(cat_index: dict[str, dict], category_id: str | None) -> tuple[str | None, str | None]:
    if not category_id:
        return None, None
    cat = cat_index.get(str(category_id))
    if not cat:
        return None, None
    parent = cat_index.get(str(cat.get("parent_id"))) if cat.get("parent_id") else None
    return cat.get("key"), (parent or {}).get("key")


def _validated_attributes(
    attributes: dict[str, Any] | None,
    *,
    cat_index: dict[str, dict],
    category_id: str | None,
) -> dict[str, Any]:
    category_key, parent_key = _category_keys(cat_index, category_id)
    try:
        return validate_product_attributes(
            attributes if isinstance(attributes, dict) else {},
            category_key=category_key,
            parent_key=parent_key,
        )
    except AttributeValidationError as exc:
        raise ApiError(
            400,
            "VALIDATION_ERROR",
            "מאפיינים טכניים לא תקינים",
            details={"fields": exc.field_errors},
        ) from exc


class ProductCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=200)
    sku: str | None = Field(default=None, max_length=80)
    description: str | None = None
    unit: str = "unit"
    kind: str = "product"
    list_price: float = Field(default=0, ge=0)
    cost: float | None = Field(default=None, ge=0)
    vat_eligible: bool = True
    category_id: str | None = None
    is_active: bool = True
    manufacturer: str | None = Field(default=None, max_length=120)
    model: str | None = Field(default=None, max_length=120)
    attributes: dict[str, Any] | None = None


class ProductPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, min_length=1, max_length=200)
    sku: str | None = Field(default=None, max_length=80)
    description: str | None = None
    unit: str | None = None
    kind: str | None = None
    list_price: float | None = Field(default=None, ge=0)
    cost: float | None = Field(default=None, ge=0)
    vat_eligible: bool | None = None
    category_id: str | None = None
    is_active: bool | None = None
    manufacturer: str | None = Field(default=None, max_length=120)
    model: str | None = Field(default=None, max_length=120)
    attributes: dict[str, Any] | None = None


def _ctx(client: UserClient, user: dict, workspace_id: UUID):
    return load_authz_context(client, actor_id(user), str(workspace_id))


def _can_view_cost(ctx) -> bool:
    return authorize(ctx=ctx, action="quotes.view_cost").allowed


def _merge_product_costs(service: ServiceClient, workspace_id: UUID, rows: list[dict]) -> list[dict]:
    """Attach cost from service_role after quotes.view_cost authorize (column lockdown)."""
    ids = [str(r["id"]) for r in rows if r.get("id")]
    if not ids:
        return rows
    by_id: dict[str, float] = {}
    chunk_size = 50
    for i in range(0, len(ids), chunk_size):
        chunk = ids[i : i + chunk_size]
        batch = as_list(
            service.get(
                "products",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "id": f"in.({','.join(chunk)})",
                    "select": PRODUCT_COST_SELECT,
                },
            )
        )
        for row in batch:
            rid = str(row.get("id") or "")
            if rid:
                by_id[rid] = float(row.get("cost") or 0)
    out: list[dict] = []
    for row in rows:
        merged = dict(row)
        rid = str(merged.get("id") or "")
        if rid in by_id:
            merged["cost"] = by_id[rid]
        out.append(merged)
    return out


def _strip_cost(row: dict, *, show_cost: bool, categories_by_id: dict[str, dict] | None = None) -> dict:
    out = dict(row)
    if not show_cost:
        for field in COST_FIELDS:
            out.pop(field, None)
    out["item_type"] = KIND_TO_ITEM.get(out.get("kind") or "product", "catalog")
    out["selling_price"] = out.get("list_price")
    out["tax"] = bool(out.get("vat_eligible", True))
    out["active"] = bool(out.get("is_active", True))
    if not isinstance(out.get("attributes"), dict):
        out["attributes"] = {}
    cats = categories_by_id or {}
    cid = out.get("category_id")
    cat = cats.get(str(cid)) if cid else None
    if cat:
        parent = cats.get(str(cat.get("parent_id"))) if cat.get("parent_id") else None
        out["category_key"] = cat.get("key")
        out["category_name"] = cat.get("name_he")
        out["category_path"] = (
            f"{parent.get('name_he')} · {cat.get('name_he')}" if parent else cat.get("name_he")
        )
        out["attribute_schema"] = attribute_schema_for_category(
            category_key=cat.get("key"),
            parent_key=(parent or {}).get("key"),
        )
    else:
        out["category_path"] = None
        out["attribute_schema"] = []
    return out


def _template_out(row: dict) -> dict:
    out = dict(row)
    nested = out.pop("quote_template_items", None) or []
    count = 0
    if isinstance(nested, list) and nested and isinstance(nested[0], dict):
        count = int(nested[0].get("count") or 0)
    elif isinstance(nested, dict):
        count = int(nested.get("count") or 0)
    out["item_count"] = count
    return out


def _new_sku(name: str) -> str:
    slug = "".join(ch for ch in name.upper() if ch.isalnum())[:8] or "ITEM"
    stamp = datetime.now(UTC).strftime("%H%M%S")
    return f"{slug}-{stamp}"


def _load_categories(client: UserClient, workspace_id: UUID, *, include_archived: bool = False) -> list[dict]:
    params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "select": CATEGORY_SELECT,
        "order": "sort_order.asc",
    }
    if not include_archived:
        params["archived_at"] = "is.null"
    return as_list(client.get("product_categories", params=params))


def _category_index(rows: list[dict]) -> dict[str, dict]:
    return {str(r["id"]): r for r in rows if r.get("id")}


def _subtree_ids(categories: list[dict], root_id: str) -> set[str]:
    by_parent: dict[str | None, list[str]] = {}
    for row in categories:
        pid = str(row["parent_id"]) if row.get("parent_id") else None
        by_parent.setdefault(pid, []).append(str(row["id"]))
    out: set[str] = set()
    stack = [root_id]
    while stack:
        cur = stack.pop()
        if cur in out:
            continue
        out.add(cur)
        stack.extend(by_parent.get(cur, []))
    return out


@router.get("/catalog/categories")
def list_categories(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    include_archived: bool = Query(default=False),
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "catalog.view")
    rows = _load_categories(client, workspace_id, include_archived=include_archived)
    by_id = _category_index(rows)
    items = []
    for row in rows:
        out = dict(row)
        parent = by_id.get(str(row["parent_id"])) if row.get("parent_id") else None
        out["parent_key"] = parent.get("key") if parent else None
        out["path"] = (
            f"{parent.get('name_he')} · {row.get('name_he')}" if parent else row.get("name_he")
        )
        out["attribute_schema"] = attribute_schema_for_category(
            category_key=row.get("key"),
            parent_key=(parent or {}).get("key"),
        )
        items.append(out)
    return {"items": items}


@router.get("/catalog/products")
def list_products(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    service: Annotated[ServiceClient, Depends(service_client)],
    limit: int | None = Query(default=50),
    cursor: str | None = Query(default=None),
    q: str | None = Query(default=None),
    kind: str | None = Query(default=None),
    category_id: str | None = Query(default=None),
    active: bool | None = Query(default=True),
    include_inactive: bool = Query(default=False),
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "catalog.view")
    categories = _load_categories(client, workspace_id, include_archived=True)
    cat_index = _category_index(categories)
    # Catalog may be large (imports); allow up to 500 per page + cursor for the rest.
    raw_limit = 50 if limit is None else int(limit)
    if raw_limit < 1 or raw_limit > 500:
        raise ApiError(400, "VALIDATION_ERROR", "מגבלת עמוד לא תקינה")
    page_size = raw_limit
    params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "select": PRODUCT_SELECT,
        # Ascending keyset: next page is name/id *greater than* the cursor (not lt).
        "order": "name.asc,id.asc",
        "limit": str(page_size + 1),
    }
    if not include_inactive:
        if active is True:
            params["is_active"] = "eq.true"
        elif active is False:
            params["is_active"] = "eq.false"
    if kind:
        params["kind"] = f"eq.{kind}"
    if category_id:
        subtree = _subtree_ids(categories, category_id)
        if len(subtree) == 1:
            params["category_id"] = f"eq.{category_id}"
        else:
            params["category_id"] = f"in.({','.join(sorted(subtree))})"
    search_inner: str | None = None
    if q:
        safe = q.replace(",", " ").replace("*", " ").replace("(", " ").replace(")", " ").strip()
        if safe:
            search_inner = (
                f"name.ilike.*{safe}*,sku.ilike.*{safe}*,"
                f"manufacturer.ilike.*{safe}*,model.ilike.*{safe}*"
            )
    marker = _decode_product_cursor(cursor)
    cursor_inner: str | None = None
    if marker:
        before_name, before_id = marker
        nq = _pg_str(before_name)
        if before_id:
            cursor_inner = f"name.gt.{nq},and(name.eq.{nq},id.gt.{before_id})"
        else:
            # Legacy name-only cursor.
            params["name"] = f"gt.{nq}"
    if search_inner and cursor_inner:
        params["and"] = f"(or({search_inner}),or({cursor_inner}))"
    elif search_inner:
        params["or"] = f"({search_inner})"
    elif cursor_inner:
        params["or"] = f"({cursor_inner})"
    rows = as_list(client.get("products", params=params))
    next_cursor = None
    items = rows
    if len(rows) > page_size:
        items = rows[:page_size]
        next_cursor = _encode_product_cursor(items[-1])
    show_cost = _can_view_cost(ctx)
    if show_cost:
        items = _merge_product_costs(service, workspace_id, items)
    return {
        "items": [_strip_cost(row, show_cost=show_cost, categories_by_id=cat_index) for row in items],
        "next_cursor": next_cursor,
    }


@router.get("/catalog/products/{product_id}")
def get_product(
    workspace_id: UUID,
    product_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    service: Annotated[ServiceClient, Depends(service_client)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "catalog.view")
    row = one_or_404(
        client.get(
            "products",
            params={"id": f"eq.{product_id}", "workspace_id": f"eq.{workspace_id}", "select": PRODUCT_SELECT},
        )
    )
    show_cost = _can_view_cost(ctx)
    if show_cost:
        row = _merge_product_costs(service, workspace_id, [row])[0]
    cats = _category_index(_load_categories(client, workspace_id, include_archived=True))
    return _strip_cost(row, show_cost=show_cost, categories_by_id=cats)


@router.post("/catalog/products")
def create_product(
    workspace_id: UUID,
    body: ProductCreate,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "catalog.edit")
    if body.kind not in {"product", "service", "bundle"}:
        raise ApiError(400, "VALIDATION_ERROR", "סוג פריט לא תקין")
    cost = body.cost
    if cost is None:
        cost = 0
    elif not _can_view_cost(ctx):
        raise ApiError(403, "PERMISSION_DENIED", "אין הרשאה לעלות")
    cats = _category_index(_load_categories(client, workspace_id, include_archived=True))
    if body.category_id and str(body.category_id) not in cats:
        raise ApiError(400, "VALIDATION_ERROR", "קטגוריה לא נמצאה")
    attributes = _validated_attributes(
        body.attributes,
        cat_index=cats,
        category_id=body.category_id,
    )
    payload = {
        "workspace_id": str(workspace_id),
        "name": body.name.strip(),
        "sku": (body.sku or "").strip() or _new_sku(body.name),
        "description": (body.description or "").strip(),
        "unit": normalize_unit(body.unit),
        "kind": body.kind,
        "list_price": body.list_price,
        "cost": cost,
        "vat_eligible": body.vat_eligible,
        "is_labor": body.kind == "service",
        "is_active": body.is_active,
        "manufacturer": (body.manufacturer or "").strip() or None,
        "model": (body.model or "").strip() or None,
        "attributes": attributes,
    }
    if body.category_id:
        payload["category_id"] = body.category_id
    # Prefer return=representation must select only columns authenticated can SELECT (no cost).
    row = created_or_403(client.post("products", payload, params={"select": PRODUCT_SELECT}))
    if isinstance(row, list):
        row = row[0] if row else {}
    return _strip_cost(row, show_cost=_can_view_cost(ctx), categories_by_id=cats)


@router.patch("/catalog/products/{product_id}")
def patch_product(
    workspace_id: UUID,
    product_id: UUID,
    body: ProductPatch,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "catalog.edit")
    existing = one_or_404(
        client.get(
            "products",
            params={
                "id": f"eq.{product_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": "id,category_id,attributes",
            },
        )
    )
    patch = body.model_dump(exclude_none=True)
    if "kind" in patch and patch["kind"] not in {"product", "service", "bundle"}:
        raise ApiError(400, "VALIDATION_ERROR", "סוג פריט לא תקין")
    if "cost" in patch and not _can_view_cost(ctx):
        raise ApiError(403, "PERMISSION_DENIED", "אין הרשאה לעלות")
    if "kind" in patch:
        patch["is_labor"] = patch["kind"] == "service"
    if "unit" in patch:
        patch["unit"] = normalize_unit(patch["unit"])
    if "manufacturer" in patch and isinstance(patch["manufacturer"], str):
        patch["manufacturer"] = patch["manufacturer"].strip() or None
    if "model" in patch and isinstance(patch["model"], str):
        patch["model"] = patch["model"].strip() or None
    cats = _category_index(_load_categories(client, workspace_id, include_archived=True))
    category_id = patch.get("category_id", existing.get("category_id"))
    if category_id and str(category_id) not in cats:
        raise ApiError(400, "VALIDATION_ERROR", "קטגוריה לא נמצאה")
    if "attributes" in patch:
        raw_attrs = patch["attributes"] if isinstance(patch["attributes"], dict) else {}
        patch["attributes"] = _validated_attributes(
            raw_attrs,
            cat_index=cats,
            category_id=category_id,
        )
    elif "category_id" in patch:
        # Re-validate stored attrs against the new category leaf.
        stored = existing.get("attributes") if isinstance(existing.get("attributes"), dict) else {}
        patch["attributes"] = _validated_attributes(
            stored,
            cat_index=cats,
            category_id=category_id,
        )
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", "אין מה לעדכן")
    row = patched_or_403(
        client.patch(
            "products",
            patch,
            params={
                "id": f"eq.{product_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": PRODUCT_SELECT,
            },
        )
    )
    return _strip_cost(row, show_cost=_can_view_cost(ctx), categories_by_id=cats)


@router.delete("/catalog/products/{product_id}")
def delete_product(
    workspace_id: UUID,
    product_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    """Hard-delete a catalog product. Quote lines keep denormalized snapshot (FK SET NULL)."""
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "catalog.edit")
    one_or_404(
        client.get(
            "products",
            params={
                "id": f"eq.{product_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": "id",
            },
        )
    )
    # Prefer minimal: authenticated cannot SELECT products.cost (Q4-S lockdown).
    acked_or_403(
        client.delete(
            "products",
            params={"id": f"eq.{product_id}", "workspace_id": f"eq.{workspace_id}"},
            prefer="return=minimal",
        )
    )
    return {"ok": True}


class BulkDeleteIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ids: list[UUID] = Field(min_length=1, max_length=200)


@router.post("/catalog/products/bulk-delete")
def bulk_delete_products(
    workspace_id: UUID,
    body: BulkDeleteIn,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    """Mass hard-delete. Quote lines keep snapshots (product_id SET NULL)."""
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "catalog.edit")
    # Preserve order, drop dupes.
    seen: set[str] = set()
    ids: list[str] = []
    for raw in body.ids:
        sid = str(raw)
        if sid in seen:
            continue
        seen.add(sid)
        ids.append(sid)
    if not ids:
        raise ApiError(400, "VALIDATION_ERROR", "לא נבחרו פריטים")
    # Chunk to keep PostgREST URL filters bounded.
    deleted = 0
    chunk_size = 50
    for i in range(0, len(ids), chunk_size):
        chunk = ids[i : i + chunk_size]
        acked_or_403(
            client.delete(
                "products",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "id": f"in.({','.join(chunk)})",
                },
                prefer="return=minimal",
            )
        )
        deleted += len(chunk)
    return {"ok": True, "deleted": deleted, "requested": len(ids)}


class BulkPricingIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mode: Literal["markup_percent", "multiplier"] = "markup_percent"
    value: float = Field(gt=0, le=1000)
    only_missing_list_price: bool = True
    category_id: str | None = None
    manufacturer: str | None = Field(default=None, max_length=120)
    dry_run: bool = False
    limit: int = Field(default=2000, ge=1, le=5000)


@router.post("/catalog/ensure-defaults")
def ensure_catalog_defaults(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    service: Annotated[ServiceClient, Depends(service_client)],
    user: Annotated[dict, Depends(current_user)],
):
    """Re-seed category hierarchy + templates (no products). Safe after accidental wipe."""
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "catalog.edit")
    res = service.post("rpc/seed_workspace_defaults", json={"p_workspace_id": str(workspace_id)})
    if getattr(res, "status_code", 500) not in {200, 204}:
        raise ApiError(503, "API_UNAVAILABLE", "לא ניתן לשחזר את היררכיית הקטגוריות")
    rows = _load_categories(client, workspace_id, include_archived=False)
    leaves = sum(1 for r in rows if r.get("parent_id"))
    roots = sum(1 for r in rows if not r.get("parent_id"))
    return {"ok": True, "roots": roots, "leaves": leaves, "categories": len(rows)}


@router.post("/catalog/products/bulk-pricing")
def bulk_pricing(
    workspace_id: UUID,
    body: BulkPricingIn,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    service: Annotated[ServiceClient, Depends(service_client)],
):
    """Set list_price from cost via markup % or multiplier for many products at once."""
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "catalog.edit")
    if not _can_view_cost(ctx):
        raise ApiError(403, "PERMISSION_DENIED", "אין הרשאה לעלות / תמחור")

    categories = _load_categories(client, workspace_id, include_archived=True)
    params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "is_active": "eq.true",
        "select": "id,sku,name,cost,list_price,category_id,manufacturer",
        "order": "name.asc",
        "limit": str(body.limit),
    }
    if body.category_id:
        subtree = _subtree_ids(categories, body.category_id)
        if len(subtree) == 1:
            params["category_id"] = f"eq.{body.category_id}"
        else:
            params["category_id"] = f"in.({','.join(sorted(subtree))})"
    if body.manufacturer and body.manufacturer.strip():
        params["manufacturer"] = f"ilike.*{body.manufacturer.strip()}*"

    rows = as_list(service.get("products", params=params))
    preview: list[dict[str, Any]] = []
    updated = 0
    skipped = 0
    for row in rows:
        cost = float(row.get("cost") or 0)
        list_price = float(row.get("list_price") or 0)
        if cost <= 0:
            skipped += 1
            continue
        if body.only_missing_list_price and list_price > 0:
            skipped += 1
            continue
        if body.mode == "markup_percent":
            next_price = round(cost * (1 + body.value / 100.0), 2)
        else:
            next_price = round(cost * body.value, 2)
        if next_price < 0:
            skipped += 1
            continue
        entry = {
            "id": row["id"],
            "sku": row.get("sku"),
            "name": row.get("name"),
            "cost": cost,
            "list_price_before": list_price,
            "list_price_after": next_price,
        }
        preview.append(entry)
        if body.dry_run:
            continue
        # User JWT cannot SELECT products.cost — PATCH return=* would 403 under Q4-S lockdown.
        patched_or_403(
            client.patch(
                "products",
                {"list_price": next_price},
                params={
                    "id": f"eq.{row['id']}",
                    "workspace_id": f"eq.{workspace_id}",
                    "select": PRODUCT_SELECT,
                },
            )
        )
        updated += 1

    return {
        "dry_run": body.dry_run,
        "matched": len(rows),
        "will_update": len(preview),
        "updated": updated if not body.dry_run else 0,
        "skipped": skipped,
        "sample": preview[:25],
        "mode": body.mode,
        "value": body.value,
    }


@router.get("/catalog/templates")
def list_templates(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "catalog.view")
    rows = as_list(
        client.get(
            "quote_templates",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "select": TEMPLATE_SELECT,
                "order": "name_he.asc",
            },
        )
    )
    return {"items": [_template_out(row) for row in rows]}
