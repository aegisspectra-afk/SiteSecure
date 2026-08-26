from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from ..authz.engine import authorize
from ..authz.guard import require
from ..catalog_attrs import attribute_schema_for_category, normalize_unit
from ..deps import UserClient, current_user, load_authz_context, user_client
from ..errors import ApiError
from ..identity import actor_id
from ..pagination import decode_cursor, page_from_rows, parse_limit
from ..rest import as_list, created_or_403, one_or_404, patched_or_403

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}", tags=["catalog"])

PRODUCT_SELECT = (
    "id,workspace_id,category_id,sku,name,description,unit,kind,list_price,cost,"
    "vat_eligible,is_labor,is_active,manufacturer,model,attributes,created_at,updated_at"
)
CATEGORY_SELECT = "id,workspace_id,key,name_he,sort_order,parent_id,archived_at"
TEMPLATE_SELECT = "id,workspace_id,key,name_he,quote_template_items(count)"
COST_FIELDS = ("cost",)

KIND_TO_ITEM = {"service": "labor", "product": "catalog", "bundle": "catalog"}


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
    page_size = parse_limit(limit)
    params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "select": PRODUCT_SELECT,
        "order": "name.asc",
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
    if q:
        safe = q.replace(",", " ").replace("*", " ").replace("(", " ").replace(")", " ").strip()
        if safe:
            params["or"] = (
                f"(name.ilike.*{safe}*,sku.ilike.*{safe}*,"
                f"manufacturer.ilike.*{safe}*,model.ilike.*{safe}*)"
            )
    before = decode_cursor(cursor)
    if before:
        params["name"] = f"lt.{before}"
    rows = as_list(client.get("products", params=params))
    page = page_from_rows(rows, page_size, cursor_field="name")
    show_cost = _can_view_cost(ctx)
    return {
        "items": [_strip_cost(row, show_cost=show_cost, categories_by_id=cat_index) for row in page.items],
        "next_cursor": page.next_cursor,
    }


@router.get("/catalog/products/{product_id}")
def get_product(
    workspace_id: UUID,
    product_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "catalog.view")
    row = one_or_404(
        client.get(
            "products",
            params={"id": f"eq.{product_id}", "workspace_id": f"eq.{workspace_id}", "select": PRODUCT_SELECT},
        )
    )
    cats = _category_index(_load_categories(client, workspace_id, include_archived=True))
    return _strip_cost(row, show_cost=_can_view_cost(ctx), categories_by_id=cats)


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
        "attributes": body.attributes if isinstance(body.attributes, dict) else {},
    }
    if body.category_id:
        payload["category_id"] = body.category_id
    row = created_or_403(client.post("products", payload))
    if isinstance(row, list):
        row = row[0] if row else {}
    cats = _category_index(_load_categories(client, workspace_id, include_archived=True))
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
    one_or_404(
        client.get(
            "products",
            params={"id": f"eq.{product_id}", "workspace_id": f"eq.{workspace_id}", "select": "id"},
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
    if "attributes" in patch and patch["attributes"] is None:
        patch["attributes"] = {}
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", "אין מה לעדכן")
    row = patched_or_403(
        client.patch(
            "products",
            patch,
            params={"id": f"eq.{product_id}", "workspace_id": f"eq.{workspace_id}"},
        )
    )
    cats = _category_index(_load_categories(client, workspace_id, include_archived=True))
    return _strip_cost(row, show_cost=_can_view_cost(ctx), categories_by_id=cats)


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
