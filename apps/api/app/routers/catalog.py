from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from ..authz.engine import authorize
from ..authz.guard import require
from ..deps import UserClient, current_user, load_authz_context, user_client
from ..errors import ApiError
from ..identity import actor_id
from ..pagination import decode_cursor, page_from_rows, parse_limit
from ..rest import as_list, created_or_403, one_or_404, patched_or_403

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}", tags=["catalog"])

PRODUCT_SELECT = (
    "id,workspace_id,category_id,sku,name,description,unit,kind,list_price,cost,"
    "vat_eligible,is_labor,is_active,created_at,updated_at"
)
CATEGORY_SELECT = "id,workspace_id,key,name_he,sort_order"
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


def _ctx(client: UserClient, user: dict, workspace_id: UUID):
    return load_authz_context(client, actor_id(user), str(workspace_id))


def _can_view_cost(ctx) -> bool:
    return authorize(ctx=ctx, action="quotes.view_cost").allowed


def _strip_cost(row: dict, *, show_cost: bool) -> dict:
    out = dict(row)
    if not show_cost:
        for field in COST_FIELDS:
            out.pop(field, None)
    out["item_type"] = KIND_TO_ITEM.get(out.get("kind") or "product", "catalog")
    out["selling_price"] = out.get("list_price")
    out["tax"] = bool(out.get("vat_eligible", True))
    out["active"] = bool(out.get("is_active", True))
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


@router.get("/catalog/categories")
def list_categories(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "catalog.view")
    rows = as_list(
        client.get(
            "product_categories",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "select": CATEGORY_SELECT,
                "order": "sort_order.asc",
            },
        )
    )
    return {"items": rows}


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
        params["category_id"] = f"eq.{category_id}"
    if q:
        safe = q.replace(",", " ").replace("*", " ").strip()
        if safe:
            params["or"] = f"(name.ilike.*{safe}*,sku.ilike.*{safe}*)"
    before = decode_cursor(cursor)
    if before:
        params["name"] = f"lt.{before}"
    rows = as_list(client.get("products", params=params))
    page = page_from_rows(rows, page_size, cursor_field="name")
    show_cost = _can_view_cost(ctx)
    return {"items": [_strip_cost(row, show_cost=show_cost) for row in page.items], "next_cursor": page.next_cursor}


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
    return _strip_cost(row, show_cost=_can_view_cost(ctx))


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
        "unit": body.unit.strip() or "unit",
        "kind": body.kind,
        "list_price": body.list_price,
        "cost": cost,
        "vat_eligible": body.vat_eligible,
        "is_labor": body.kind == "service",
        "is_active": body.is_active,
    }
    if body.category_id:
        payload["category_id"] = body.category_id
    row = created_or_403(client.post("products", payload))
    return _strip_cost(row, show_cost=_can_view_cost(ctx))


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
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", "אין מה לעדכן")
    row = patched_or_403(
        client.patch(
            "products",
            patch,
            params={"id": f"eq.{product_id}", "workspace_id": f"eq.{workspace_id}"},
        )
    )
    return _strip_cost(row, show_cost=_can_view_cost(ctx))


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
