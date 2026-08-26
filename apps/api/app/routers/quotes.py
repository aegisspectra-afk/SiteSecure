from __future__ import annotations

from datetime import UTC, date, datetime, time
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field

from .. import pricing
from ..audit import write_audit
from ..authz.engine import authorize
from ..authz.guard import require
from ..authz.types import ResourceRef
from ..config import get_settings
from ..deps import UserClient, current_user, load_authz_context, service_client, user_client
from ..errors import ApiError, MESSAGES
from ..identity import actor_id
from ..pagination import decode_cursor, page_from_rows, parse_limit
from ..quote_pdf import render_quote_pdf
from ..quote_snapshot import catalog_line_snapshot, public_payload, version_snapshot
from ..quote_tokens import hash_public_token, new_public_token
from ..quote_validation import advisory_checks, critical_gaps_only, validate_for_send
from ..rest import acked_or_403, as_list, created_or_403, one_or_404, patched_or_403
from ..supabase_service import ServiceClient

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}", tags=["quotes"])

SHAREABLE_STATES = frozenset({"sent", "viewed", "approved"})
# Draft may mint a secure link without marking the quote as sent.

QUOTE_SELECT = (
    "id,workspace_id,number,status,customer_id,site_id,lead_id,owner_user_id,"
    "currency,vat_percent,discount_type,discount_value,subtotal_net,vat_amount,"
    "total_gross,cost_total,margin_amount,margin_percent,valid_until,payment_terms,"
    "customer_notes,internal_notes,title,project_name,project_address,summary,"
    "key_points,warranty,general_terms,template_id,version,sent_at,viewed_at,"
    "approved_at,rejected_at,approved_name,rejection_reason,"
    "margin_override_reason,margin_override_by,margin_override_at,revise_reason,"
    "created_at,updated_at,customers(display_name),sites(name)"
)
QUOTE_LIST_SELECT = (
    "id,workspace_id,number,status,customer_id,site_id,lead_id,owner_user_id,currency,"
    "total_gross,cost_total,margin_amount,margin_percent,valid_until,title,"
    "project_name,version,created_at,updated_at,"
    "customers(display_name),sites(name)"
)
OPEN_LIST_STATUSES = frozenset({"draft", "sent", "viewed"})
ITEM_SELECT = (
    "id,quote_id,product_id,item_type,description,qty,unit_price,cost,discount,"
    "discount_type,line_net,sort_order,sku,name,unit,catalog_snapshot,"
    "section_id,package_instance_id,package_id,package_name"
)
SECTION_SELECT = (
    "id,quote_id,name,sort_order,discount_type,discount_value,collapsed,created_at,updated_at"
)
PRODUCT_SELECT = (
    "id,sku,name,description,unit,kind,list_price,cost,vat_eligible,is_labor,is_active,"
    "manufacturer,model,attributes"
)
COST_FIELDS = ("cost_total", "margin_amount", "margin_percent")
ITEM_COST_FIELDS = ("cost",)
ITEM_TYPES = frozenset({"catalog", "free", "labor", "note"})


class QuoteCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    customer_id: str | None = None
    site_id: str | None = None
    lead_id: str | None = None
    title: str | None = None
    project_name: str | None = None
    project_address: str | None = None
    summary: str | None = None
    key_points: str | None = None
    warranty: str | None = None
    general_terms: str | None = None
    template_id: str | None = None
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
    lead_id: str | None = None
    title: str | None = None
    project_name: str | None = None
    project_address: str | None = None
    summary: str | None = None
    key_points: str | None = None
    warranty: str | None = None
    general_terms: str | None = None
    template_id: str | None = None
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
    item_type: str = "free"
    description: str = ""
    sku: str | None = None
    name: str | None = None
    qty: float = Field(default=1, ge=0)
    unit_price: float | None = Field(default=None, ge=0)
    cost: float | None = Field(default=None, ge=0)
    discount: float = Field(default=0, ge=0)
    discount_type: str = "amount"
    sort_order: int = 0
    section_id: str | None = None
    package_instance_id: str | None = None
    package_id: str | None = None
    package_name: str | None = None


class QuoteItemPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    description: str | None = None
    sku: str | None = None
    qty: float | None = Field(default=None, ge=0)
    unit_price: float | None = Field(default=None, ge=0)
    cost: float | None = Field(default=None, ge=0)
    discount: float | None = Field(default=None, ge=0)
    discount_type: str | None = None
    sort_order: int | None = None
    item_type: str | None = None
    name: str | None = None
    section_id: str | None = None


class ApplyTemplateIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    template_id: str | None = None


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


def _nested_name(row: dict, key: str, field: str) -> str | None:
    nested = row.get(key)
    name = None
    if isinstance(nested, dict):
        name = nested.get(field)
    elif isinstance(nested, list) and nested:
        name = nested[0].get(field) if isinstance(nested[0], dict) else None
    cleaned = str(name or "").strip()
    return cleaned or None


def _flatten_quote(row: dict) -> dict:
    out = dict(row)
    if "customers" in out:
        out["customer_name"] = _nested_name(row, "customers", "display_name")
        out.pop("customers", None)
    else:
        out.setdefault("customer_name", None)
    if "sites" in out:
        out["site_name"] = _nested_name(row, "sites", "name")
        out.pop("sites", None)
    else:
        out.setdefault("site_name", None)
    return out


def _quote_list_counts(rows: list[dict]) -> dict:
    counts = {
        "draft": 0,
        "sent": 0,
        "viewed": 0,
        "approved": 0,
        "rejected": 0,
        "expired": 0,
        "cancelled": 0,
        "total": len(rows),
        "open_value": 0.0,
    }
    for row in rows:
        status = str(row.get("status") or "")
        if status in counts:
            counts[status] += 1
        if status in OPEN_LIST_STATUSES:
            counts["open_value"] += float(row.get("total_gross") or 0)
    return counts


def _strip_cost(quote: dict, items: list[dict], *, show_cost: bool) -> dict:
    out = dict(quote)
    out_items = []
    for item in items:
        row = dict(item)
        if not show_cost:
            for field in ITEM_COST_FIELDS:
                row.pop(field, None)
            snap = dict(row.get("catalog_snapshot") or {})
            snap.pop("cost", None)
            row["catalog_snapshot"] = snap
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


def _load_sections(client: UserClient, workspace_id: UUID, quote_id: UUID) -> list[dict]:
    try:
        return as_list(
            client.get(
                "quote_sections",
                params={
                    "quote_id": f"eq.{quote_id}",
                    "workspace_id": f"eq.{workspace_id}",
                    "select": SECTION_SELECT,
                    "order": "sort_order.asc",
                },
            )
        )
    except Exception:
        return []


def _load_workspace(client: UserClient, workspace_id: UUID) -> dict:
    return one_or_404(
        client.get("workspaces", params={"id": f"eq.{workspace_id}", "select": "id,name,vat_percent"})
    )


def _load_quote_settings(client: UserClient, workspace_id: UUID) -> dict:
    try:
        rows = as_list(
            client.get(
                "workspace_settings",
                params={"workspace_id": f"eq.{workspace_id}", "select": "quotes,taxes,branding"},
            )
        )
        return rows[0] if rows else {}
    except Exception:
        return {}


def _normalize_discount_type(raw: str | None) -> str:
    value = (raw or "amount").lower().strip()
    if value in {"percent", "%"}:
        return "percent"
    if value in {"amount", "fixed"}:
        return "amount"
    raise ApiError(400, "VALIDATION_ERROR", "סוג הנחה לא תקין")


def _maybe_row(client: UserClient, table: str, row_id: str | None, workspace_id: UUID, select: str) -> dict | None:
    if not row_id:
        return None
    rows = as_list(
        client.get(
            table,
            params={"id": f"eq.{row_id}", "workspace_id": f"eq.{workspace_id}", "select": select},
        )
    )
    return rows[0] if rows else None


def _persist_totals(
    client: UserClient, workspace_id: UUID, quote: dict, items: list[dict]
) -> tuple[dict, list[dict]]:
    sections = _load_sections(client, workspace_id, UUID(quote["id"]))
    computed = pricing.recalculate(
        items,
        vat_percent=quote.get("vat_percent"),
        discount_type=quote.get("discount_type"),
        discount_value=quote.get("discount_value"),
        sections=sections,
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


def _insert_line(client: UserClient, workspace_id: UUID, quote_id: UUID, body: QuoteItemIn, ctx) -> bool:
    item_type = _normalize_item_type(body.item_type)
    discount_type = _normalize_discount_type(body.discount_type)
    product = None
    snapshot: dict = {}
    unit_price = body.unit_price
    cost = body.cost
    description = body.description.strip()
    sku = None
    name = None
    unit = None
    if body.product_id:
        products = as_list(
            client.get(
                "products",
                params={
                    "id": f"eq.{body.product_id}",
                    "workspace_id": f"eq.{workspace_id}",
                    "select": PRODUCT_SELECT,
                },
            )
        )
        if not products:
            return False
        product = products[0]
        snapshot = catalog_line_snapshot(product)
        sku = product.get("sku")
        name = product.get("name")
        unit = product.get("unit")
        if not description:
            description = (product.get("description") or product.get("name") or "").strip()
        if unit_price is None:
            unit_price = float(product.get("list_price") or 0)
        elif abs(float(unit_price) - float(product.get("list_price") or 0)) > 0.009:
            if not authorize(ctx=ctx, action="quotes.override_price").allowed:
                raise ApiError(403, "PERMISSION_DENIED", "אין הרשאה לדריסת מחיר מכירה")
        if cost is None:
            cost = float(product.get("cost") or 0)
        if item_type == "free":
            item_type = "labor" if product.get("kind") == "service" or product.get("is_labor") else "catalog"
    else:
        # Free / manual line — allow optional SKU + display name from request body
        if body.sku is not None:
            sku = body.sku.strip() or None
        if body.name is not None:
            name = body.name.strip() or None
        elif description:
            name = description
    # Catalog-linked lines: allow override SKU from body when explicitly provided
    if body.product_id and body.sku is not None:
        sku = body.sku.strip() or None
    if body.product_id and body.name is not None:
        name = body.name.strip() or None
    if unit_price is None:
        unit_price = 0
    if cost is None:
        cost = 0
    elif body.cost is not None and not _can_view_cost(ctx):
        raise ApiError(403, "PERMISSION_DENIED", "אין הרשאה לעלות")
    payload = {
        "workspace_id": str(workspace_id),
        "quote_id": str(quote_id),
        "product_id": body.product_id,
        "item_type": item_type,
        "description": description,
        "qty": body.qty,
        "unit_price": unit_price,
        "cost": cost,
        "discount": body.discount,
        "discount_type": discount_type,
        "sort_order": body.sort_order,
        "sku": sku,
        "name": name,
        "unit": unit,
        "catalog_snapshot": snapshot,
        "section_id": body.section_id,
        "package_instance_id": body.package_instance_id,
        "package_id": body.package_id,
        "package_name": body.package_name,
        "line_net": float(
            pricing.line_net(
                qty=body.qty,
                unit_price=unit_price,
                discount=body.discount,
                item_type=item_type,
                discount_type=discount_type,
            )
        ),
    }
    created_or_403(client.post("quote_items", payload))
    return True


def _normalize_item_type(raw: str | None) -> str:
    value = (raw or "free").lower()
    if value == "custom":
        return "free"
    if value == "service":
        return "labor"
    if value not in ITEM_TYPES:
        raise ApiError(400, "VALIDATION_ERROR", "סוג שורה לא תקין")
    return value


def _record_event(client: UserClient, workspace_id: UUID, quote_id: UUID, event_type: str, actor: str, metadata: dict) -> None:
    try:
        client.post(
            "quote_events",
            {
                "workspace_id": str(workspace_id),
                "quote_id": str(quote_id),
                "event_type": event_type,
                "actor_id": actor,
                "metadata": metadata,
            },
        )
    except Exception:
        return


def _with_validation(client: UserClient, workspace_id: UUID, quote: dict, items: list[dict], *, show_cost: bool) -> dict:
    workspace = _load_workspace(client, workspace_id)
    settings = _load_quote_settings(client, workspace_id)
    critical = validate_for_send(quote, items, workspace, settings)
    soft = advisory_checks(quote, items, workspace, settings)
    gaps = [*critical, *soft]
    out = _strip_cost(_flatten_quote(quote), items, show_cost=show_cost)
    sections = _load_sections(client, workspace_id, UUID(quote["id"]))
    out["sections"] = sections
    quotes_cfg = settings.get("quotes") if isinstance(settings.get("quotes"), dict) else {}
    if show_cost:
        out["margin_status"] = pricing.margin_status(
            quote.get("margin_percent"),
            target=quotes_cfg.get("margin_target", 30),
            minimum=quotes_cfg.get("margin_minimum", 15),
        )
        out["margin_target"] = float(quotes_cfg.get("margin_target", 30))
        out["margin_minimum"] = float(quotes_cfg.get("margin_minimum", 15))
    out["validation"] = {"can_send": len(critical_gaps_only(gaps)) == 0, "gaps": gaps}
    return out


def _public_url(token: str) -> str:
    base = get_settings().web_public_url.rstrip("/")
    return f"{base}/q/{token}"


def _revoke_public_access(svc: ServiceClient, workspace_id: UUID, quote_id: UUID) -> None:
    svc.patch(
        "quote_public_access",
        {"revoked_at": datetime.now(UTC).isoformat()},
        params={
            "quote_id": f"eq.{quote_id}",
            "workspace_id": f"eq.{workspace_id}",
            "revoked_at": "is.null",
        },
    )


DUPLICATE_FIELDS = (
    "customer_id",
    "site_id",
    "lead_id",
    "title",
    "project_name",
    "project_address",
    "summary",
    "key_points",
    "warranty",
    "general_terms",
    "template_id",
    "vat_percent",
    "discount_type",
    "discount_value",
    "valid_until",
    "payment_terms",
    "customer_notes",
    "internal_notes",
    "currency",
)


def _related(client: UserClient, workspace_id: UUID, quote: dict) -> tuple[dict, dict | None, dict | None]:
    workspace = _load_workspace(client, workspace_id)
    customer = _maybe_row(
        client,
        "customers",
        quote.get("customer_id"),
        workspace_id,
        "id,display_name,email,phone,billing_address",
    )
    site = _maybe_row(client, "sites", quote.get("site_id"), workspace_id, "id,name,address")
    return workspace, customer, site


def _access_expires_at(quote: dict) -> str | None:
    """Optional mint TTL = valid_until end-of-day UTC when present."""
    raw = str(quote.get("valid_until") or "").strip()
    if not raw:
        return None
    try:
        until = date.fromisoformat(raw[:10])
    except ValueError:
        return None
    return datetime.combine(until, time(23, 59, 59), tzinfo=UTC).isoformat()


def _mint_access(svc: ServiceClient, quote: dict, token: str) -> None:
    created_or_403(
        svc.post(
            "quote_public_access",
            {
                "workspace_id": quote["workspace_id"],
                "quote_id": quote["id"],
                "version": quote.get("version") or 1,
                "token_hash": hash_public_token(token),
                "expires_at": _access_expires_at(quote),
            },
        )
    )


def _upsert_version_snapshot(
    client: UserClient,
    user: dict,
    workspace_id: UUID,
    quote: dict,
    items: list[dict],
    *,
    snapshot_status: str,
) -> None:
    """Freeze (or refresh) the customer-facing snapshot for the current quote version."""
    quote_id = UUID(str(quote["id"]))
    version = int(quote.get("version") or 1)
    workspace, customer, site = _related(client, workspace_id, quote)
    settings = _load_quote_settings(client, workspace_id)
    branding = settings.get("branding") if isinstance(settings.get("branding"), dict) else {}
    sections = _load_sections(client, workspace_id, quote_id)
    snapshot = version_snapshot(
        quote,
        items,
        workspace=workspace,
        customer=customer,
        site=site,
        status=snapshot_status,
        sections=sections,
        branding=branding,
    )
    existing = as_list(
        client.get(
            "quote_versions",
            params={
                "quote_id": f"eq.{quote_id}",
                "workspace_id": f"eq.{workspace_id}",
                "version": f"eq.{version}",
                "select": "id",
            },
        )
    )
    if existing:
        acked_or_403(
            client.patch(
                "quote_versions",
                {"snapshot": snapshot},
                params={
                    "id": f"eq.{existing[0]['id']}",
                    "workspace_id": f"eq.{workspace_id}",
                },
                prefer="return=minimal",
            )
        )
        return
    created_or_403(
        client.post(
            "quote_versions",
            {
                "workspace_id": str(workspace_id),
                "quote_id": str(quote_id),
                "version": version,
                "snapshot": snapshot,
                "created_by": actor_id(user),
            },
        )
    )


def _prepare_share_link(
    client: UserClient,
    svc: ServiceClient,
    user: dict,
    workspace_id: UUID,
    existing: dict,
    *,
    require_complete: bool,
) -> tuple[dict, list[dict], str]:
    """Validate (optional), upsert snapshot, mint token. Never changes quote status."""
    quote_id = UUID(str(existing["id"]))
    items = _load_items(client, workspace_id, quote_id)
    existing, items = _persist_totals(client, workspace_id, existing, items)
    workspace, _customer, _site = _related(client, workspace_id, existing)
    settings = _load_quote_settings(client, workspace_id)
    if require_complete:
        gaps = validate_for_send(existing, items, workspace, settings)
        if gaps:
            raise ApiError(400, "QUOTE_INCOMPLETE", MESSAGES["QUOTE_INCOMPLETE"], {"gaps": gaps})
        soft = advisory_checks(existing, items, workspace, settings)
        _ = soft
    status = str(existing.get("status") or "draft")
    _upsert_version_snapshot(
        client,
        user,
        workspace_id,
        existing,
        items,
        snapshot_status=status if status != "draft" else "draft",
    )
    token = new_public_token()
    _mint_access(svc, existing, token)
    return existing, items, token


def _document_payload(
    client: UserClient,
    workspace_id: UUID,
    quote: dict,
    items: list[dict],
) -> dict:
    workspace, customer, site = _related(client, workspace_id, quote)
    sections = _load_sections(client, workspace_id, UUID(quote["id"]))
    settings = _load_quote_settings(client, workspace_id)
    branding = settings.get("branding") if isinstance(settings.get("branding"), dict) else {}
    return public_payload(
        quote,
        items,
        workspace=workspace,
        customer=customer,
        site=site,
        sections=sections,
        branding=branding,
    )


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
    lead_id: str | None = Query(default=None),
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "quotes.view")
    page_size = parse_limit(limit)
    params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "deleted_at": "is.null",
        "select": QUOTE_LIST_SELECT,
        "order": "created_at.desc",
        "limit": str(page_size + 1),
    }
    if status:
        params["status"] = f"eq.{status}"
    if customer_id:
        params["customer_id"] = f"eq.{customer_id}"
    if lead_id:
        params["lead_id"] = f"eq.{lead_id}"
    if q:
        safe = q.replace(",", " ").replace("*", " ").strip()
        if safe:
            params["or"] = (
                f"(number.ilike.*{safe}*,title.ilike.*{safe}*,project_name.ilike.*{safe}*,"
                f"customers.display_name.ilike.*{safe}*)"
            )
    before = decode_cursor(cursor)
    if before:
        params["created_at"] = f"lt.{before}"
    rows = as_list(client.get("quotes", params=params))
    page = page_from_rows(rows, page_size)
    show_cost = _can_view_cost(ctx)
    items = [_strip_cost(_flatten_quote(row), [], show_cost=show_cost) for row in page.items]
    count_rows = as_list(
        client.get(
            "quotes",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "deleted_at": "is.null",
                "select": "status,total_gross",
            },
        )
    )
    return {
        "items": items,
        "next_cursor": page.next_cursor,
        "counts": _quote_list_counts(count_rows),
    }


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
        ws = _load_workspace(client, workspace_id)
        vat = float(ws.get("vat_percent") or 18)
    payload = {
        "workspace_id": str(workspace_id),
        "created_by": actor_id(user),
        "owner_user_id": actor_id(user),
        "vat_percent": vat,
        **body.model_dump(exclude_none=True, exclude={"vat_percent"}),
    }
    row = created_or_403(client.post("quotes", payload))
    lead_id = row.get("lead_id") or body.lead_id
    if lead_id:
        try:
            client.patch(
                "leads",
                {"status": "quoted"},
                params={"id": f"eq.{lead_id}", "workspace_id": f"eq.{workspace_id}"},
            )
        except Exception:
            pass
    return _with_validation(client, workspace_id, row, [], show_cost=_can_view_cost(ctx))


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
    return _with_validation(client, workspace_id, row, items, show_cost=_can_view_cost(ctx))


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
    # Allow explicit nulls for FK clears (customer/site/lead replacement).
    clearable = {"customer_id", "site_id", "lead_id", "template_id"}
    raw = body.model_dump(exclude_unset=True)
    patch = {k: v for k, v in raw.items() if v is not None or k in clearable}
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", "אין מה לעדכן")
    if any(k in patch for k in ("total_gross", "subtotal_net", "vat_amount", "cost_total")):
        raise ApiError(400, "VALIDATION_ERROR", "סה״כ מחושב בשרת בלבד")
    row = patched_or_403(
        client.patch("quotes", patch, params={"id": f"eq.{quote_id}", "workspace_id": f"eq.{workspace_id}"})
    )
    items = _load_items(client, workspace_id, quote_id)
    row, items = _persist_totals(client, workspace_id, row, items)
    return _with_validation(client, workspace_id, row, items, show_cost=_can_view_cost(ctx))


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
    if not _insert_line(client, workspace_id, quote_id, body, ctx):
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    _record_event(
        client,
        workspace_id,
        quote_id,
        "item_added",
        actor_id(user),
        {"product_id": body.product_id, "description": body.description},
    )
    items = _load_items(client, workspace_id, quote_id)
    row, items = _persist_totals(client, workspace_id, existing, items)
    return _with_validation(client, workspace_id, row, items, show_cost=_can_view_cost(ctx))


@router.post("/quotes/{quote_id}/apply-template")
def apply_template(
    workspace_id: UUID,
    quote_id: UUID,
    body: ApplyTemplateIn,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    existing = _load_quote(client, workspace_id, quote_id)
    require(ctx, "quotes.edit", resource=_ref(existing))
    template_id = body.template_id or existing.get("template_id")
    if not template_id:
        raise ApiError(400, "VALIDATION_ERROR", "בחרו תבנית להחלה")
    template = one_or_404(
        client.get(
            "quote_templates",
            params={"id": f"eq.{template_id}", "workspace_id": f"eq.{workspace_id}", "select": "id,key,name_he"},
        )
    )
    template_items = as_list(
        client.get(
            "quote_template_items",
            params={
                "template_id": f"eq.{template['id']}",
                "workspace_id": f"eq.{workspace_id}",
                "select": "product_id,description,qty,sort_order",
                "order": "sort_order.asc",
            },
        )
    )
    if not template_items:
        raise ApiError(400, "TEMPLATE_EMPTY", MESSAGES["TEMPLATE_EMPTY"])
    existing_items = _load_items(client, workspace_id, quote_id)
    sort_base = max((int(item.get("sort_order") or 0) for item in existing_items), default=0)
    inserted = 0
    for index, row in enumerate(template_items, start=1):
        product_id = row.get("product_id")
        if not product_id:
            continue
        qty = float(row.get("qty") or 1)
        if qty <= 0:
            continue
        ok = _insert_line(
            client,
            workspace_id,
            quote_id,
            QuoteItemIn(
                product_id=str(product_id),
                item_type="catalog",
                description=str(row.get("description") or ""),
                qty=qty,
                sort_order=sort_base + (index * 10),
            ),
            ctx,
        )
        if ok:
            inserted += 1
    if inserted == 0:
        raise ApiError(400, "TEMPLATE_EMPTY", MESSAGES["TEMPLATE_EMPTY"])
    patched = patched_or_403(
        client.patch(
            "quotes",
            {"template_id": template["id"]},
            params={"id": f"eq.{quote_id}", "workspace_id": f"eq.{workspace_id}"},
        )
    )
    _record_event(
        client,
        workspace_id,
        quote_id,
        "template_applied",
        actor_id(user),
        {"template_id": template["id"], "lines": inserted},
    )
    items = _load_items(client, workspace_id, quote_id)
    row, items = _persist_totals(client, workspace_id, patched, items)
    return _with_validation(client, workspace_id, row, items, show_cost=_can_view_cost(ctx))


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
    if "item_type" in patch:
        patch["item_type"] = _normalize_item_type(patch["item_type"])
    if "discount_type" in patch:
        patch["discount_type"] = _normalize_discount_type(patch["discount_type"])
    if "cost" in patch and not _can_view_cost(ctx) and not authorize(ctx=ctx, action="quotes.override_price").allowed:
        raise ApiError(403, "PERMISSION_DENIED", "אין הרשאה לעלות")
    before_rows = as_list(
        client.get(
            "quote_items",
            params={
                "id": f"eq.{item_id}",
                "quote_id": f"eq.{quote_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": ITEM_SELECT,
            },
        )
    )
    before = before_rows[0] if before_rows else {}
    if "unit_price" in patch and before:
        snap = before.get("catalog_snapshot") or {}
        list_price = snap.get("list_price")
        if list_price is not None and abs(float(patch["unit_price"]) - float(list_price)) > 0.009:
            if not authorize(ctx=ctx, action="quotes.override_price").allowed:
                raise ApiError(403, "PERMISSION_DENIED", "אין הרשאה לדריסת מחיר מכירה")
            _record_event(
                client,
                workspace_id,
                quote_id,
                "price_override",
                actor_id(user),
                {
                    "item_id": str(item_id),
                    "before": before.get("unit_price"),
                    "after": patch["unit_price"],
                    "list_price": list_price,
                },
            )
            write_audit(
                client,
                str(workspace_id),
                "quotes.price_override",
                entity_type="quote_item",
                entity_id=str(item_id),
                metadata={"before": before.get("unit_price"), "after": patch["unit_price"]},
            )
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", "אין מה לעדכן")
    patched_or_403(
        client.patch(
            "quote_items",
            patch,
            params={"id": f"eq.{item_id}", "quote_id": f"eq.{quote_id}", "workspace_id": f"eq.{workspace_id}"},
        )
    )
    _record_event(
        client,
        workspace_id,
        quote_id,
        "item_updated",
        actor_id(user),
        {"item_id": str(item_id), "before": {k: before.get(k) for k in patch}, "after": patch},
    )
    items = _load_items(client, workspace_id, quote_id)
    row, items = _persist_totals(client, workspace_id, existing, items)
    return _with_validation(client, workspace_id, row, items, show_cost=_can_view_cost(ctx))


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
    _record_event(
        client,
        workspace_id,
        quote_id,
        "item_removed",
        actor_id(user),
        {"item_id": str(item_id)},
    )
    items = _load_items(client, workspace_id, quote_id)
    row, items = _persist_totals(client, workspace_id, existing, items)
    return _with_validation(client, workspace_id, row, items, show_cost=_can_view_cost(ctx))


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
    return _with_validation(client, workspace_id, row, items, show_cost=_can_view_cost(ctx))


@router.post("/quotes/{quote_id}/send")
def send_quote(
    workspace_id: UUID,
    quote_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    svc: Annotated[ServiceClient, Depends(service_client)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    existing = _load_quote(client, workspace_id, quote_id)
    require(ctx, "quotes.send", resource=_ref(existing))
    row, items, token = _transition_to_sent(client, svc, user, workspace_id, existing)
    out = _with_validation(client, workspace_id, row, items, show_cost=_can_view_cost(ctx))
    out["public_url"] = _public_url(token)
    out["public_token"] = token
    return out


def _transition_to_sent(
    client: UserClient,
    svc: ServiceClient,
    user: dict,
    workspace_id: UUID,
    existing: dict,
) -> tuple[dict, list[dict], str]:
    """Validate, snapshot, mark sent, mint public token. Caller must authorize quotes.send."""
    quote_id = UUID(str(existing["id"]))
    items = _load_items(client, workspace_id, quote_id)
    existing, items = _persist_totals(client, workspace_id, existing, items)
    workspace, _customer, _site = _related(client, workspace_id, existing)
    settings = _load_quote_settings(client, workspace_id)
    gaps = validate_for_send(existing, items, workspace, settings)
    if gaps:
        raise ApiError(400, "QUOTE_INCOMPLETE", MESSAGES["QUOTE_INCOMPLETE"], {"gaps": gaps})
    soft = advisory_checks(existing, items, workspace, settings)
    _ = soft  # advisory only — never blocks send
    now = datetime.now(UTC).isoformat()
    version = int(existing.get("version") or 1)
    _upsert_version_snapshot(
        client,
        user,
        workspace_id,
        existing,
        items,
        snapshot_status="sent",
    )
    row = patched_or_403(
        client.patch(
            "quotes",
            {"status": "sent", "sent_at": now},
            params={"id": f"eq.{quote_id}", "workspace_id": f"eq.{workspace_id}"},
        )
    )
    token = new_public_token()
    _mint_access(svc, row, token)
    _record_event(
        client,
        workspace_id,
        quote_id,
        "sent",
        actor_id(user),
        {"version": version},
    )
    write_audit(
        client,
        str(workspace_id),
        "quotes.send",
        entity_type="quote",
        entity_id=str(quote_id),
        metadata={"version": version},
    )
    return row, items, token


@router.post("/quotes/{quote_id}/revise")
def revise_quote(
    workspace_id: UUID,
    quote_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    reason: str | None = None,
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    existing = _load_quote(client, workspace_id, quote_id)
    require(
        ctx,
        "quotes.create",
        resource=ResourceRef(
            type="quote_revision",
            id=existing["id"],
            owner_user_id=existing.get("owner_user_id"),
            site_id=existing.get("site_id"),
            state=existing.get("status"),
        ),
    )
    next_version = int(existing.get("version") or 1) + 1
    patch = {
        "status": "draft",
        "version": next_version,
        "sent_at": None,
        "viewed_at": None,
        "approved_at": None,
        "rejected_at": None,
        "approved_name": None,
        "rejection_reason": None,
        "margin_override_reason": None,
        "margin_override_by": None,
        "margin_override_at": None,
        "revise_reason": (reason or "").strip() or None,
    }
    row = patched_or_403(
        client.patch(
            "quotes",
            patch,
            params={"id": f"eq.{quote_id}", "workspace_id": f"eq.{workspace_id}"},
        )
    )
    items = _load_items(client, workspace_id, quote_id)
    _record_event(
        client,
        workspace_id,
        quote_id,
        "revised",
        actor_id(user),
        {"from_version": next_version - 1, "to_version": next_version, "reason": reason},
    )
    write_audit(
        client,
        str(workspace_id),
        "quotes.revise",
        entity_type="quote",
        entity_id=str(quote_id),
        metadata={"version": next_version, "reason": reason},
    )
    return _with_validation(client, workspace_id, row, items, show_cost=_can_view_cost(ctx))


@router.post("/quotes/{quote_id}/share")
def share_quote(
    workspace_id: UUID,
    quote_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    svc: Annotated[ServiceClient, Depends(service_client)],
) -> dict:
    """Mint (or re-mint) a secure customer link.

    Creating a link must NOT mark the quote as sent. Sent/locked is an explicit
    `/send` action (or customer first-open promotion on the public route).
    """
    ctx = _ctx(client, user, workspace_id)
    existing = _load_quote(client, workspace_id, quote_id)
    # Capability check only — reminting a link on sent/viewed/approved must not hit
    # QUOTE_SENDABLE (draft-only). Draft still validates completeness below.
    require(ctx, "quotes.send")
    status = existing.get("status")
    if status == "draft":
        require(ctx, "quotes.send", resource=_ref(existing))
        existing, _items, token = _prepare_share_link(
            client,
            svc,
            user,
            workspace_id,
            existing,
            require_complete=True,
        )
        event_type = "share_link_created"
    elif status in SHAREABLE_STATES:
        existing, _items, token = _prepare_share_link(
            client,
            svc,
            user,
            workspace_id,
            existing,
            require_complete=False,
        )
        event_type = "shared"
    else:
        raise ApiError(
            403,
            "RESOURCE_STATE",
            "לא ניתן ליצור קישור במצב הנוכחי של ההצעה",
            {"state": status},
        )
    _record_event(
        client,
        workspace_id,
        quote_id,
        event_type,
        actor_id(user),
        {"version": existing.get("version") or 1},
    )
    write_audit(
        client,
        str(workspace_id),
        "quotes.share_link",
        entity_type="quote",
        entity_id=str(quote_id),
        metadata={"version": existing.get("version") or 1, "event": event_type},
    )
    return {
        "public_url": _public_url(token),
        "public_token": token,
        "status": existing.get("status"),
        "link_created": True,
        # Always false — kept for older clients that checked this flag.
        "auto_sent": False,
    }


@router.post("/quotes/{quote_id}/revoke-link")
def revoke_quote_link(
    workspace_id: UUID,
    quote_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    svc: Annotated[ServiceClient, Depends(service_client)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    existing = _load_quote(client, workspace_id, quote_id)
    # Capability only — revoke is used on sent/viewed/approved links; QUOTE_SENDABLE is draft-only.
    require(ctx, "quotes.send")
    _revoke_public_access(svc, workspace_id, quote_id)
    _record_event(
        client,
        workspace_id,
        quote_id,
        "link_revoked",
        actor_id(user),
        {"version": existing.get("version") or 1},
    )
    write_audit(
        client,
        str(workspace_id),
        "quotes.revoke_link",
        entity_type="quote",
        entity_id=str(quote_id),
        metadata={"version": existing.get("version") or 1},
    )
    return {"ok": True}


@router.delete("/quotes/{quote_id}")
def delete_quote(
    workspace_id: UUID,
    quote_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    svc: Annotated[ServiceClient, Depends(service_client)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    existing = _load_quote(client, workspace_id, quote_id)
    require(ctx, "quotes.delete", resource=_ref(existing))
    now = datetime.now(UTC).isoformat()
    patch: dict = {"deleted_at": now}
    if existing.get("status") in {"sent", "viewed"}:
        patch["status"] = "cancelled"
    _record_event(client, workspace_id, quote_id, "deleted", actor_id(user), {"from_status": existing.get("status")})
    write_audit(
        client,
        str(workspace_id),
        "quotes.delete",
        entity_type="quote",
        entity_id=str(quote_id),
        metadata={"from_status": existing.get("status")},
    )
    # SELECT RLS is `deleted_at IS NULL`. A user-JWT PATCH that stamps deleted_at
    # cannot RETURN the row; PostgREST answers 404 and the API used to surface 403.
    # authorize() already ran against the live row. Service role only stamps that id.
    acked_or_403(
        svc.patch(
            "quotes",
            patch,
            params={"id": f"eq.{quote_id}", "workspace_id": f"eq.{workspace_id}"},
            prefer="return=minimal",
        )
    )
    try:
        _revoke_public_access(svc, workspace_id, quote_id)
    except Exception:
        pass
    return {"ok": True}


@router.post("/quotes/{quote_id}/duplicate")
def duplicate_quote(
    workspace_id: UUID,
    quote_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    existing = _load_quote(client, workspace_id, quote_id)
    require(ctx, "quotes.view", resource=_ref(existing))
    require(ctx, "quotes.create")
    payload = {
        "workspace_id": str(workspace_id),
        "created_by": actor_id(user),
        "owner_user_id": actor_id(user),
    }
    for field in DUPLICATE_FIELDS:
        if existing.get(field) is not None:
            payload[field] = existing[field]
    title = str(existing.get("title") or "").strip()
    if title:
        payload["title"] = f"{title} (העתק)"
    row = created_or_403(client.post("quotes", payload))
    items = _load_items(client, workspace_id, quote_id)
    for item in items:
        created_or_403(
            client.post(
                "quote_items",
                {
                    "workspace_id": str(workspace_id),
                    "quote_id": row["id"],
                    "product_id": item.get("product_id"),
                    "item_type": item.get("item_type") or "free",
                    "description": item.get("description") or "",
                    "qty": item.get("qty") or 0,
                    "unit_price": item.get("unit_price") or 0,
                    "cost": item.get("cost") or 0,
                    "discount": item.get("discount") or 0,
                    "discount_type": item.get("discount_type") or "amount",
                    "sort_order": item.get("sort_order") or 0,
                    "sku": item.get("sku"),
                    "name": item.get("name"),
                    "unit": item.get("unit"),
                    "catalog_snapshot": item.get("catalog_snapshot") or {},
                    "section_id": item.get("section_id"),
                    "package_instance_id": item.get("package_instance_id"),
                    "package_id": item.get("package_id"),
                    "package_name": item.get("package_name"),
                    "line_net": item.get("line_net") or 0,
                },
            )
        )
    copied = _load_items(client, workspace_id, UUID(row["id"]))
    row, copied = _persist_totals(client, workspace_id, row, copied)
    _record_event(
        client,
        workspace_id,
        UUID(row["id"]),
        "duplicated",
        actor_id(user),
        {"source_quote_id": str(quote_id)},
    )
    write_audit(
        client,
        str(workspace_id),
        "quotes.duplicate",
        entity_type="quote",
        entity_id=row["id"],
        metadata={"source_quote_id": str(quote_id)},
    )
    return _with_validation(client, workspace_id, row, copied, show_cost=_can_view_cost(ctx))


@router.get("/quotes/{quote_id}/preview")
def preview_quote(
    workspace_id: UUID,
    quote_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    """Back-compat alias of /document — same customer-facing payload."""
    ctx = _ctx(client, user, workspace_id)
    row = _load_quote(client, workspace_id, quote_id)
    require(ctx, "quotes.view", resource=_ref(row))
    items = _load_items(client, workspace_id, quote_id)
    return _document_payload(client, workspace_id, row, items)
