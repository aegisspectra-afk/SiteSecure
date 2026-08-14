from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from .. import pricing
from ..authz.engine import authorize
from ..authz.guard import require
from ..authz.types import ResourceRef
from ..deps import UserClient, current_user, load_authz_context, user_client
from ..errors import ApiError
from ..identity import actor_id
from ..pagination import decode_cursor, page_from_rows, parse_limit
from ..rest import as_list, created_or_403, one_or_404, patched_or_403

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}", tags=["quotes"])

QUOTE_SELECT = (
    "id,workspace_id,number,status,customer_id,site_id,lead_id,owner_user_id,"
    "currency,vat_percent,discount_type,discount_value,subtotal_net,vat_amount,"
    "total_gross,cost_total,margin_amount,margin_percent,valid_until,payment_terms,"
    "customer_notes,internal_notes,version,created_at,updated_at"
)
ITEM_SELECT = (
    "id,quote_id,product_id,item_type,description,qty,unit_price,cost,discount,line_net,sort_order"
)
COST_FIELDS = ("cost_total", "margin_amount", "margin_percent")
ITEM_COST_FIELDS = ("cost",)


class QuoteCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    customer_id: str | None = None
    site_id: str | None = None
    lead_id: str | None = None
    vat_percent: float | None = Field(default=None, ge=0, le=100)
    discount_type: str | None = None
    discount_value: float | None = Field(default=None, ge=0)
    valid_until: str | None = None
    payment_terms: str | None = None
    customer_notes: str | None = None
    internal_notes: str | None = None


class QuotePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    customer_id: str | None = None
    site_id: str | None = None
    vat_percent: float | None = Field(default=None, ge=0, le=100)
    discount_type: str | None = None
    discount_value: float | None = Field(default=None, ge=0)
    valid_until: str | None = None
    payment_terms: str | None = None
    customer_notes: str | None = None
    internal_notes: str | None = None


class QuoteItemIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    product_id: str | None = None
    item_type: str = "catalog"
    description: str = ""
    qty: float = Field(default=1, ge=0)
    unit_price: float = Field(default=0, ge=0)
    cost: float | None = Field(default=None, ge=0)
    discount: float = Field(default=0, ge=0)
    sort_order: int = 0


class QuoteItemPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    description: str | None = None
    qty: float | None = Field(default=None, ge=0)
    unit_price: float | None = Field(default=None, ge=0)
    cost: float | None = Field(default=None, ge=0)
    discount: float | None = Field(default=None, ge=0)
    sort_order: int | None = None
    item_type: str | None = None


def _ctx(client: UserClient, user: dict, workspace_id: UUID):
    return load_authz_context(client, actor_id(user), str(workspace_id))


def _ref(row: dict) -> ResourceRef:
    return ResourceRef(
        type="quote",
        id=row["id"],
        owner_user_id=row.get("owner_user_id"),
        site_id=row.get("site_id"),
        state=row.get("status"),
    )


def _can_view_cost(ctx) -> bool:
    return authorize(ctx=ctx, action="quotes.view_cost").allowed


def _strip_cost(quote: dict, items: list[dict], *, show_cost: bool) -> dict:
    out = dict(quote)
    out_items = []
    for item in items:
        row = dict(item)
        if not show_cost:
            for field in ITEM_COST_FIELDS:
                row.pop(field, None)
        out_items.append(row)
    if not show_cost:
        for field in COST_FIELDS:
            out.pop(field, None)
    out["items"] = out_items
    return out


def _load_quote(client: UserClient, workspace_id: UUID, quote_id: UUID) -> dict:
    return one_or_404(
        client.get(
            "quotes",
            params={"id": f"eq.{quote_id}", "workspace_id": f"eq.{workspace_id}", "select": QUOTE_SELECT},
        )
    )


def _load_items(client: UserClient, workspace_id: UUID, quote_id: UUID) -> list[dict]:
    return as_list(
        client.get(
            "quote_items",
            params={
                "quote_id": f"eq.{quote_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": ITEM_SELECT,
                "order": "sort_order.asc",
            },
        )
    )


def _persist_totals(
    client: UserClient, workspace_id: UUID, quote: dict, items: list[dict]
) -> tuple[dict, list[dict]]:
    computed = pricing.recalculate(
        items,
        vat_percent=quote.get("vat_percent"),
        discount_type=quote.get("discount_type"),
        discount_value=quote.get("discount_value"),
    )
    for item, computed_item in zip(items, computed["items"], strict=True):
        if float(item.get("line_net") or 0) != computed_item["line_net"]:
            client.patch(
                "quote_items",
                {"line_net": computed_item["line_net"]},
                params={"id": f"eq.{item['id']}", "workspace_id": f"eq.{workspace_id}"},
            )
            item["line_net"] = computed_item["line_net"]
    totals = {
        "subtotal_net": computed["subtotal_net"],
        "vat_amount": computed["vat_amount"],
        "total_gross": computed["total_gross"],
        "cost_total": computed["cost_total"],
        "margin_amount": computed["margin_amount"],
        "margin_percent": computed["margin_percent"],
    }
    patched = patched_or_403(
        client.patch(
            "quotes",
            totals,
            params={"id": f"eq.{quote['id']}", "workspace_id": f"eq.{workspace_id}"},
        )
    )
    return patched, items


@router.get("/quotes")
def list_quotes(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    limit: int | None = Query(default=50),
    cursor: str | None = Query(default=None),
    q: str | None = Query(default=None),
    status: str | None = Query(default=None),
    customer_id: str | None = Query(default=None),
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "quotes.view")
    page_size = parse_limit(limit)
    params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "select": QUOTE_SELECT,
        "order": "created_at.desc",
        "limit": str(page_size + 1),
    }
    if status:
        params["status"] = f"eq.{status}"
    if customer_id:
        params["customer_id"] = f"eq.{customer_id}"
    if q:
        params["number"] = f"ilike.*{q}*"
    before = decode_cursor(cursor)
    if before:
        params["created_at"] = f"lt.{before}"
    rows = as_list(client.get("quotes", params=params))
    page = page_from_rows(rows, page_size)
    show_cost = _can_view_cost(ctx)
    items = [_strip_cost(row, [], show_cost=show_cost) for row in page.items]
    return {"items": items, "next_cursor": page.next_cursor}


@router.post("/quotes")
def create_quote(
    workspace_id: UUID,
    body: QuoteCreate,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "quotes.create", resource=ResourceRef(type="quote", owner_user_id=actor_id(user)))
    vat = body.vat_percent
    if vat is None:
        ws = one_or_404(
            client.get("workspaces", params={"id": f"eq.{workspace_id}", "select": "id,vat_percent"})
        )
        vat = float(ws.get("vat_percent") or 18)
    payload = {
        "workspace_id": str(workspace_id),
        "created_by": actor_id(user),
        "owner_user_id": actor_id(user),
        "vat_percent": vat,
        **body.model_dump(exclude_none=True, exclude={"vat_percent"}),
    }
    row = created_or_403(client.post("quotes", payload))
    return _strip_cost(row, [], show_cost=_can_view_cost(ctx))


@router.get("/quotes/{quote_id}")
def get_quote(
    workspace_id: UUID,
    quote_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "quotes.view")
    row = _load_quote(client, workspace_id, quote_id)
    require(ctx, "quotes.view", resource=_ref(row))
    items = _load_items(client, workspace_id, quote_id)
    return _strip_cost(row, items, show_cost=_can_view_cost(ctx))


@router.patch("/quotes/{quote_id}")
def patch_quote(
    workspace_id: UUID,
    quote_id: UUID,
    body: QuotePatch,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    existing = _load_quote(client, workspace_id, quote_id)
    require(ctx, "quotes.edit", resource=_ref(existing))
    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", "אין מה לעדכן")
    if "cost" in patch or any(k in patch for k in ("total_gross", "subtotal_net", "vat_amount")):
        raise ApiError(400, "VALIDATION_ERROR", "סה״כ מחושב בשרת בלבד")
    row = patched_or_403(
        client.patch("quotes", patch, params={"id": f"eq.{quote_id}", "workspace_id": f"eq.{workspace_id}"})
    )
    items = _load_items(client, workspace_id, quote_id)
    row, items = _persist_totals(client, workspace_id, row, items)
    return _strip_cost(row, items, show_cost=_can_view_cost(ctx))


@router.post("/quotes/{quote_id}/items")
def add_item(
    workspace_id: UUID,
    quote_id: UUID,
    body: QuoteItemIn,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    existing = _load_quote(client, workspace_id, quote_id)
    require(ctx, "quotes.edit", resource=_ref(existing))
    cost = body.cost
    if cost is None:
        cost = 0
    elif not _can_view_cost(ctx):
        raise ApiError(403, "PERMISSION_DENIED", "אין הרשאה לעלות")
    payload = {
        "workspace_id": str(workspace_id),
        "quote_id": str(quote_id),
        **body.model_dump(exclude_none=True),
        "cost": cost,
        "line_net": float(
            pricing.line_net(
                qty=body.qty,
                unit_price=body.unit_price,
                discount=body.discount,
                item_type=body.item_type,
            )
        ),
    }
    created_or_403(client.post("quote_items", payload))
    items = _load_items(client, workspace_id, quote_id)
    row, items = _persist_totals(client, workspace_id, existing, items)
    return _strip_cost(row, items, show_cost=_can_view_cost(ctx))


@router.patch("/quotes/{quote_id}/items/{item_id}")
def patch_item(
    workspace_id: UUID,
    quote_id: UUID,
    item_id: UUID,
    body: QuoteItemPatch,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    existing = _load_quote(client, workspace_id, quote_id)
    require(ctx, "quotes.edit", resource=_ref(existing))
    patch = body.model_dump(exclude_none=True)
    if "cost" in patch and not _can_view_cost(ctx) and not authorize(ctx=ctx, action="quotes.override_price").allowed:
        raise ApiError(403, "PERMISSION_DENIED", "אין הרשאה לעלות")
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", "אין מה לעדכן")
    patched_or_403(
        client.patch(
            "quote_items",
            patch,
            params={"id": f"eq.{item_id}", "quote_id": f"eq.{quote_id}", "workspace_id": f"eq.{workspace_id}"},
        )
    )
    items = _load_items(client, workspace_id, quote_id)
    row, items = _persist_totals(client, workspace_id, existing, items)
    return _strip_cost(row, items, show_cost=_can_view_cost(ctx))


@router.delete("/quotes/{quote_id}/items/{item_id}")
def delete_item(
    workspace_id: UUID,
    quote_id: UUID,
    item_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    existing = _load_quote(client, workspace_id, quote_id)
    require(ctx, "quotes.edit", resource=_ref(existing))
    res = client.delete(
        "quote_items",
        params={"id": f"eq.{item_id}", "quote_id": f"eq.{quote_id}", "workspace_id": f"eq.{workspace_id}"},
    )
    if res.status_code not in {200, 204}:
        raise ApiError(403, "PERMISSION_DENIED", "אין הרשאה לפעולה זו")
    items = _load_items(client, workspace_id, quote_id)
    row, items = _persist_totals(client, workspace_id, existing, items)
    return _strip_cost(row, items, show_cost=_can_view_cost(ctx))


@router.post("/quotes/{quote_id}/recalculate")
def recalculate_quote(
    workspace_id: UUID,
    quote_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    existing = _load_quote(client, workspace_id, quote_id)
    require(ctx, "quotes.edit", resource=_ref(existing))
    items = _load_items(client, workspace_id, quote_id)
    row, items = _persist_totals(client, workspace_id, existing, items)
    return _strip_cost(row, items, show_cost=_can_view_cost(ctx))
