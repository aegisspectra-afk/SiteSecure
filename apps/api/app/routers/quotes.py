from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field

from .. import pricing
from ..audit import write_audit
from ..authz.engine import authorize
from ..authz.guard import require
from ..authz.limits import evaluate_count_limit, raise_plan_limit
from ..authz.types import ResourceRef
from ..authz.usage import fetch_quotes_count
from ..config import get_settings
from ..deps import UserClient, current_user, load_authz_context, service_client, user_client
from ..notify import notify_quote_event, try_notify
from .catalog import STARTER_SAMPLE_MARKER
from ..errors import ApiError, MESSAGES
from ..identity import actor_id
from ..pagination import decode_cursor, page_from_rows, parse_limit
from ..quote_pdf import render_quote_pdf
from ..quote_snapshot import catalog_line_snapshot, public_payload, version_snapshot
from ..quote_tokens import hash_public_token, new_public_token
from ..quote_validation import advisory_checks, critical_gaps_only, validate_for_send
from ..quote_workspace_defaults import apply_quote_create_defaults, merge_quote_pdf_template_defaults
from ..rest import acked_or_403, as_list, created_or_403, one_or_404, patched_or_403
from ..csv_export import (
    EXPORT_MAX,
    EXPORT_PAGE,
    QUOTE_STATUS_HE,
    build_csv,
    csv_response,
)
from ..quote_visibility import VisibilityMode, quote_visibility_filters
from ..search_query import sanitize_search_q
from ..supabase_service import ServiceClient

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}", tags=["quotes"])

SHAREABLE_STATES = frozenset({"sent", "viewed", "approved"})
# Draft may mint a secure link without marking the quote as sent.

QUOTE_SELECT = (
    "id,workspace_id,number,status,customer_id,contact_id,site_id,lead_id,owner_user_id,"
    "currency,vat_percent,discount_type,discount_value,subtotal_net,vat_amount,"
    "total_gross,cost_total,margin_amount,margin_percent,valid_until,payment_terms,"
    "customer_notes,internal_notes,title,project_name,project_address,summary,"
    "key_points,warranty,general_terms,template_id,version,sent_at,viewed_at,"
    "approved_at,rejected_at,approved_name,rejection_reason,"
    "margin_override_reason,margin_override_by,margin_override_at,revise_reason,"
    "presentation_mode,approved_alternative_id,"
    "archived_at,archived_by,deleted_at,"
    "created_at,updated_at,customers(display_name),sites(name)"
)
# Authenticated RETURNING/select must omit cost columns (Q4-S column lockdown).
QUOTE_SELECT_SAFE = (
    "id,workspace_id,number,status,customer_id,contact_id,site_id,lead_id,owner_user_id,"
    "currency,vat_percent,discount_type,discount_value,subtotal_net,vat_amount,"
    "total_gross,valid_until,payment_terms,"
    "customer_notes,internal_notes,title,project_name,project_address,summary,"
    "key_points,warranty,general_terms,template_id,version,sent_at,viewed_at,"
    "approved_at,rejected_at,approved_name,rejection_reason,"
    "margin_override_reason,margin_override_by,margin_override_at,revise_reason,"
    "presentation_mode,approved_alternative_id,"
    "archived_at,archived_by,deleted_at,"
    "created_at,updated_at,customers(display_name),sites(name)"
)
QUOTE_LIST_SELECT = (
    "id,workspace_id,number,status,customer_id,contact_id,site_id,lead_id,owner_user_id,currency,"
    "subtotal_net,total_gross,valid_until,title,"
    "project_name,version,archived_at,archived_by,created_at,updated_at,"
    "customers(display_name),sites(name)"
)
QUOTE_LIST_COST_SELECT = "id,cost_total,margin_amount,margin_percent"
OPEN_LIST_STATUSES = frozenset({"draft", "sent", "viewed"})
ITEM_SELECT = (
    "id,quote_id,product_id,item_type,description,qty,unit_price,cost,discount,"
    "discount_type,line_net,sort_order,sku,name,unit,catalog_snapshot,"
    "section_id,package_instance_id,package_id,package_name,is_optional,alternative_id"
)
ITEM_SELECT_SAFE = (
    "id,quote_id,product_id,item_type,description,qty,unit_price,discount,"
    "discount_type,line_net,sort_order,sku,name,unit,catalog_snapshot,"
    "section_id,package_instance_id,package_id,package_name,is_optional,alternative_id"
)
SECTION_SELECT = (
    "id,quote_id,name,sort_order,discount_type,discount_value,collapsed,"
    "alternative_id,created_at,updated_at"
)
PRODUCT_SELECT = (
    "id,sku,name,description,unit,kind,list_price,cost,vat_eligible,is_labor,is_active,"
    "manufacturer,model,attributes"
)
COST_FIELDS = (
    "cost_total",
    "margin_amount",
    "margin_percent",
    "optional_cost_total",
    "gross_profit",
    "markup_percent",
)
ITEM_COST_FIELDS = ("cost", "line_cost", "gross_profit", "margin_percent", "markup_percent")
ITEM_TYPES = frozenset({"catalog", "free", "labor", "note"})


class QuoteCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    customer_id: str | None = None
    contact_id: str | None = None
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
    contact_id: str | None = None
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
    discount_type: str = "percent"
    sort_order: int = 0
    section_id: str | None = None
    package_instance_id: str | None = None
    package_id: str | None = None
    package_name: str | None = None
    is_optional: bool = False


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
    is_optional: bool | None = None


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


def _assert_contact_belongs_to_customer(
    client: UserClient,
    workspace_id: UUID,
    *,
    customer_id: str | None,
    contact_id: str | None,
) -> None:
    if not contact_id:
        return
    if not customer_id:
        raise ApiError(400, "VALIDATION_ERROR", "לא ניתן לשייך איש קשר בלי לקוח")
    rows = as_list(
        client.get(
            "customer_contacts",
            params={
                "id": f"eq.{contact_id}",
                "workspace_id": f"eq.{workspace_id}",
                "customer_id": f"eq.{customer_id}",
                "select": "id,workspace_id,customer_id",
            },
        )
    )
    row = rows[0] if rows else None
    if not row or str(row.get("workspace_id") or "") != str(workspace_id):
        raise ApiError(400, "VALIDATION_ERROR", "איש הקשר אינו שייך ללקוח של ההצעה")


_QUOTE_REF_TABLES = (
    ("customer_id", "customers", "הלקוח"),
    ("site_id", "sites", "האתר"),
    ("lead_id", "leads", "הליד"),
)


def _assert_refs_in_workspace(client: UserClient, workspace_id: UUID, values: dict) -> None:
    """customer/site/lead ids on a quote must be rows of the same workspace the caller can see."""
    for field, table, label in _QUOTE_REF_TABLES:
        ref = values.get(field)
        if not ref:
            continue
        rows = as_list(
            client.get(
                table,
                params={"id": f"eq.{ref}", "workspace_id": f"eq.{workspace_id}", "select": "id", "limit": "1"},
            )
        )
        if not rows:
            raise ApiError(400, "VALIDATION_ERROR", f"{label} לא נמצא בסביבת העבודה")


def _customer_ids_matching_name(client: UserClient, workspace_id: UUID, safe: str) -> list[str]:
    rows = as_list(
        client.get(
            "customers",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "display_name": f"ilike.*{safe}*",
                "select": "id",
                "limit": "50",
            },
        )
    )
    return [str(row["id"]) for row in rows if row.get("id")]


def _assert_margin_allows_send(ctx, quote: dict, settings: dict | None) -> None:
    """B2: below-minimum margin is advisory only (yellow warning) — never blocks send.

    Kept as a no-op hook so call sites and older tests remain stable; profitability
    warnings continue via quote_rules.margin_rule advisory gaps.
    """
    return


def _service() -> ServiceClient:
    """Privileged PostgREST reader for commercial columns (SELECT revoked from authenticated)."""
    return ServiceClient(get_settings())


# Customer-facing breakdown from pricing.recalculate (no cost or margin keys).
PRICING_BREAKDOWN_KEYS = (
    "items_subtotal",
    "sections_breakdown",
    "lines_subtotal",
    "section_discount_amount",
    "quote_discount_amount",
    "optional_subtotal",
    "optional_vat_amount",
    "optional_total_gross",
    "total_with_options_gross",
)


def _pricing_breakdown(quote: dict, items: list[dict], sections: list[dict]) -> dict:
    computed = pricing.recalculate(
        items,
        vat_percent=quote.get("vat_percent"),
        discount_type=quote.get("discount_type"),
        discount_value=quote.get("discount_value"),
        sections=sections,
    )
    return {key: computed.get(key) for key in PRICING_BREAKDOWN_KEYS}


def _quote_writer() -> ServiceClient:
    """Writes to quote totals/lifecycle, quote_items and quote_versions.

    INSERT/UPDATE on these is revoked from `authenticated` (S2 migration) so a member JWT
    cannot bypass pricing.recalculate, cost/override permissions or send/revise rules via
    PostgREST. Callers load the quote under RLS (`_load_quote`: id + workspace_id) and pass
    authz first; every write filters on — or inserts — the path workspace_id.
    """
    return _service()


def _assert_section_on_quote(
    client: UserClient, workspace_id: UUID, quote_id: UUID, section_id: str | None
) -> None:
    if not section_id:
        return
    rows = as_list(
        client.get(
            "quote_sections",
            params={
                "id": f"eq.{section_id}",
                "quote_id": f"eq.{quote_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": "id",
            },
        )
    )
    if not rows:
        raise ApiError(400, "VALIDATION_ERROR", "הסעיף לא שייך להצעה זו")


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
    """Load quote with commercial columns via service_role after caller authorize()."""
    # Visibility: first prove the row is visible to the caller under RLS.
    visible = one_or_404(
        client.get(
            "quotes",
            params={
                "id": f"eq.{quote_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": "id",
            },
        )
    )
    del visible
    return one_or_404(
        _service().get(
            "quotes",
            params={"id": f"eq.{quote_id}", "workspace_id": f"eq.{workspace_id}", "select": QUOTE_SELECT},
        )
    )


def _load_items(client: UserClient, workspace_id: UUID, quote_id: UUID) -> list[dict]:
    """Load items including cost via service_role. Caller must authorize first."""
    # Visibility gate: quote must be selectable by the user JWT.
    one_or_404(
        client.get(
            "quotes",
            params={"id": f"eq.{quote_id}", "workspace_id": f"eq.{workspace_id}", "select": "id"},
        )
    )
    return as_list(
        _service().get(
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
        client.get(
            "workspaces",
            params={"id": f"eq.{workspace_id}", "select": "id,name,vat_percent,timezone"},
        )
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
    writer = _quote_writer()
    computed = pricing.recalculate(
        items,
        vat_percent=quote.get("vat_percent"),
        discount_type=quote.get("discount_type"),
        discount_value=quote.get("discount_value"),
        sections=sections,
    )
    for item, computed_item in zip(items, computed["items"], strict=True):
        if float(item.get("line_net") or 0) != computed_item["line_net"]:
            writer.patch(
                "quote_items",
                {"line_net": computed_item["line_net"]},
                params={
                    "id": f"eq.{item['id']}",
                    "workspace_id": f"eq.{workspace_id}",
                    "select": ITEM_SELECT_SAFE,
                },
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
    optional_totals = {
        "optional_subtotal": computed.get("optional_subtotal"),
        "optional_vat_amount": computed.get("optional_vat_amount"),
        "optional_total_gross": computed.get("optional_total_gross"),
        "total_with_options_gross": computed.get("total_with_options_gross"),
        "optional_cost_total": computed.get("optional_cost_total"),
    }
    patched = patched_or_403(
        writer.patch(
            "quotes",
            totals,
            params={
                "id": f"eq.{quote['id']}",
                "workspace_id": f"eq.{workspace_id}",
                "select": QUOTE_SELECT_SAFE,
            },
        )
    )
    return {**patched, **totals, **optional_totals}, items


TEMPLATE_ITEM_SELECT = (
    "product_id,description,qty,sort_order,section_name,unit_price,discount,discount_type,item_type"
)


def _section_name_key(name: str | None) -> str | None:
    if not name:
        return None
    cleaned = str(name).strip()
    return cleaned or None


def _resolve_template_section_id(
    client: UserClient,
    workspace_id: UUID,
    quote_id: UUID,
    section_name: str | None,
    *,
    section_by_name: dict[str, str],
    existing_sections: list[dict],
    next_sort: int,
) -> tuple[str | None, int]:
    key = _section_name_key(section_name)
    if not key:
        return None, next_sort
    if key in section_by_name:
        return section_by_name[key], next_sort
    for sec in existing_sections:
        if _section_name_key(sec.get("name")) == key:
            sid = str(sec["id"])
            section_by_name[key] = sid
            return sid, next_sort
    row = created_or_403(
        client.post(
            "quote_sections",
            {
                "workspace_id": str(workspace_id),
                "quote_id": str(quote_id),
                "name": key,
                "sort_order": next_sort,
                "discount_type": "amount",
                "discount_value": 0,
                "collapsed": False,
            },
        )
    )
    existing_sections.append(row)
    section_by_name[key] = str(row["id"])
    return section_by_name[key], next_sort + 10


def _template_item_to_quote_item_in(
    row: dict,
    *,
    sort_order: int,
    section_id: str | None,
) -> QuoteItemIn | None:
    qty = float(row.get("qty") or 1)
    if qty <= 0:
        return None
    item_type = _normalize_item_type(str(row.get("item_type") or "catalog"))
    product_id = row.get("product_id")
    if item_type == "catalog" and not product_id:
        return None
    payload: dict = {
        "item_type": item_type,
        "description": str(row.get("description") or ""),
        "qty": qty,
        "sort_order": sort_order,
        "section_id": section_id,
    }
    if product_id:
        payload["product_id"] = str(product_id)
    if row.get("unit_price") is not None:
        payload["unit_price"] = float(row["unit_price"])
    if row.get("discount") is not None:
        payload["discount"] = float(row["discount"])
    if row.get("discount_type") is not None:
        payload["discount_type"] = str(row["discount_type"])
    return QuoteItemIn(**payload)


def _insert_line(
    client: UserClient,
    workspace_id: UUID,
    quote_id: UUID,
    body: QuoteItemIn,
    ctx,
    *,
    allow_template_price: bool = False,
) -> bool:
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
            _service().get(
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
            if not allow_template_price and not authorize(ctx=ctx, action="quotes.override_price").allowed:
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
    # DEMO-2.1: the starter "sample price" mark is office-only; a customer line always
    # carries the product name instead (also for products seeded before the fix).
    if (description or "").strip() == STARTER_SAMPLE_MARKER:
        description = (name or "").strip()
    if unit_price is None:
        unit_price = 0
    if cost is None:
        cost = 0
    elif body.cost is not None and not _can_view_cost(ctx):
        raise ApiError(403, "PERMISSION_DENIED", "אין הרשאה לעלות")
    _assert_section_on_quote(client, workspace_id, quote_id, body.section_id)
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
        "is_optional": bool(body.is_optional),
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
    created_or_403(
        _quote_writer().post(
            "quote_items",
            payload,
            params={"select": ITEM_SELECT_SAFE},
        )
    )
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


CUSTOMER_SUMMARY_SELECT = "id,display_name,type,phone,email"


def _customer_summary(client: UserClient, workspace_id: UUID, customer_id: object) -> dict | None:
    """Read-only minimum about the quote's customer, for anyone who may open the quote.

    Sales has owned-scope CRM access and customers carry no owner, so GET /customers/{id} is
    denied even for the customer of a quote they own. Read with the member JWT (RLS applies),
    in the quote's workspace only; no notes, tax id or billing address.
    """
    if not customer_id:
        return None
    res = client.get(
        "customers",
        params={
            "id": f"eq.{customer_id}",
            "workspace_id": f"eq.{workspace_id}",
            "select": CUSTOMER_SUMMARY_SELECT,
            "limit": "1",
        },
    )
    if getattr(res, "status_code", None) != 200:
        return None
    rows = res.json()
    return rows[0] if isinstance(rows, list) and rows else None


def _with_validation(client: UserClient, workspace_id: UUID, quote: dict, items: list[dict], *, show_cost: bool) -> dict:
    workspace = _load_workspace(client, workspace_id)
    settings = _load_quote_settings(client, workspace_id)
    customer_summary = _customer_summary(client, workspace_id, quote.get("customer_id"))
    critical = validate_for_send(quote, items, workspace, settings)
    soft = advisory_checks(quote, items, workspace, settings)
    gaps = [*critical, *soft]
    out = _strip_cost(_flatten_quote(quote), items, show_cost=show_cost)
    sections = _load_sections(client, workspace_id, UUID(quote["id"]))
    out["sections"] = sections
    computed = pricing.recalculate(
        items,
        vat_percent=quote.get("vat_percent"),
        discount_type=quote.get("discount_type"),
        discount_value=quote.get("discount_value"),
        sections=sections,
    )
    out.update({key: computed.get(key) for key in PRICING_BREAKDOWN_KEYS})
    if show_cost:
        out["optional_cost_total"] = computed.get("optional_cost_total")
    else:
        out.pop("optional_cost_total", None)
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
    out["customer_summary"] = customer_summary
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


QUOTE_PUBLIC_LINK_TTL = timedelta(days=30)


def _access_expires_at(quote: dict, *, now: datetime | None = None) -> str:
    """Mint TTL: valid_until end-of-day UTC, otherwise now + 30 days. Never null."""
    clock = now or datetime.now(UTC)
    raw = str(quote.get("valid_until") or "").strip()
    if raw:
        try:
            until = date.fromisoformat(raw[:10])
            return datetime.combine(until, time(23, 59, 59), tzinfo=UTC).isoformat()
        except ValueError:
            pass
    return (clock + QUOTE_PUBLIC_LINK_TTL).isoformat()


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
    quotes_cfg = settings.get("quotes") if isinstance(settings.get("quotes"), dict) else {}
    sections = _load_sections(client, workspace_id, quote_id)
    # The send/share row comes back with the safe select only; recompute the breakdown so
    # the frozen customer document carries option and discount totals.
    quote = {**quote, **_pricing_breakdown(quote, items, sections)}
    # B3: freeze ועד-בית alternatives with server totals at send time (no cost in public).
    alternatives_for_snapshot: list[dict] = []
    try:
        alt_rows = as_list(
            client.get(
                "quote_alternatives",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "quote_id": f"eq.{quote_id}",
                    "select": "id,label,sort_order,is_recommended,customer_summary",
                    "order": "sort_order.asc",
                },
            )
        )
    except Exception:
        alt_rows = []
    if alt_rows:
        breakdown = pricing.recalculate_alternatives(
            items,
            alt_rows,
            vat_percent=quote.get("vat_percent") or 17,
            discount_type=quote.get("discount_type"),
            discount_value=quote.get("discount_value") or 0,
            sections=sections,
        )
        by_id = {str(row["alternative_id"]): row for row in breakdown}
        for alt in alt_rows:
            totals = by_id.get(str(alt["id"]), {})
            alternatives_for_snapshot.append(
                {
                    **alt,
                    "subtotal_net": totals.get("subtotal_net", 0),
                    "vat_amount": totals.get("vat_amount", 0),
                    "total_gross": totals.get("total_gross", 0),
                }
            )
        if alternatives_for_snapshot and not quote.get("presentation_mode"):
            quote = {**quote, "presentation_mode": "alternatives"}
    pdf_tpl_row = _load_default_pdf_template(client, workspace_id)
    pdf_template: dict | None = None
    if pdf_tpl_row:
        config = pdf_tpl_row.get("config") if isinstance(pdf_tpl_row.get("config"), dict) else {}
        pdf_template = {
            "id": pdf_tpl_row.get("id"),
            "name": pdf_tpl_row.get("name"),
            **config,
        }
        merge_quote_pdf_template_defaults(pdf_template, quotes_cfg=quotes_cfg, config=config)
    else:
        pdf_template = {}
        merge_quote_pdf_template_defaults(pdf_template, quotes_cfg=quotes_cfg, config={})
    snapshot = version_snapshot(
        quote,
        items,
        workspace=workspace,
        customer=customer,
        site=site,
        status=snapshot_status,
        sections=sections,
        alternatives=alternatives_for_snapshot or None,
        branding=branding,
        pdf_template=pdf_template,
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
    writer = _quote_writer()
    if existing:
        # return=representation: a silent 0-row update must fail, not publish a stale snapshot.
        patched_or_403(
            writer.patch(
                "quote_versions",
                {"snapshot": snapshot},
                params={
                    "id": f"eq.{existing[0]['id']}",
                    "quote_id": f"eq.{quote_id}",
                    "workspace_id": f"eq.{workspace_id}",
                    "select": "id",
                },
            )
        )
        return
    created_or_403(
        writer.post(
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


def _load_default_pdf_template(client: UserClient, workspace_id: UUID) -> dict | None:
    """Deterministic quote template: default → active → any non-archived."""
    rows = as_list(
        client.get(
            "pdf_document_templates",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "doc_type": "eq.quote",
                "is_default": "eq.true",
                "select": "id,name,config,status",
                "limit": "1",
            },
        )
    )
    if rows and str(rows[0].get("status") or "") != "archived":
        return rows[0]
    for status in ("active", "draft"):
        rows = as_list(
            client.get(
                "pdf_document_templates",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "doc_type": "eq.quote",
                    "status": f"eq.{status}",
                    "select": "id,name,config,status",
                    "order": "created_at.asc",
                    "limit": "1",
                },
            )
        )
        if rows:
            return rows[0]
    return None


# Non-draft lifecycle states whose customer document must equal the sent version snapshot.
_SNAPSHOT_PDF_STATES = frozenset({"sent", "viewed", "approved", "rejected", "expired"})


def _document_payload(
    client: UserClient,
    workspace_id: UUID,
    quote: dict,
    items: list[dict],
) -> dict:
    from ..documents.company_profile import missing_quote_company_fields, normalize_company_profile

    status = str(quote.get("status") or "draft")
    # A3: formally sent current version — staff document = immutable snapshot.public
    # (same customer content source as public PDF). Draft remains live.
    if status in _SNAPSHOT_PDF_STATES:
        version = int(quote.get("version") or 1)
        versions = as_list(
            client.get(
                "quote_versions",
                params={
                    "quote_id": f"eq.{quote['id']}",
                    "workspace_id": f"eq.{workspace_id}",
                    "version": f"eq.{version}",
                    "select": "snapshot",
                    "limit": "1",
                },
            )
        )
        if versions:
            snap = versions[0].get("snapshot") if isinstance(versions[0].get("snapshot"), dict) else {}
            public = snap.get("public") if isinstance(snap.get("public"), dict) else {}
            if public:
                out = dict(public)
                # Keep live lifecycle overlays consistent with public assemble.
                out["status"] = status
                out["version"] = version
                out["viewed_at"] = quote.get("viewed_at")
                out["approved_at"] = quote.get("approved_at")
                out["approved_name"] = quote.get("approved_name")
                out["rejected_at"] = quote.get("rejected_at")
                out["sent_at"] = quote.get("sent_at")
                return out

    workspace, customer, site = _related(client, workspace_id, quote)
    sections = _load_sections(client, workspace_id, UUID(quote["id"]))
    settings = _load_quote_settings(client, workspace_id)
    branding = settings.get("branding") if isinstance(settings.get("branding"), dict) else {}
    quotes_cfg = settings.get("quotes") if isinstance(settings.get("quotes"), dict) else {}
    profile = normalize_company_profile(workspace, branding)
    missing = missing_quote_company_fields(profile)
    if missing:
        raise ApiError(
            400,
            "COMPANY_PROFILE_INCOMPLETE",
            "חסרים פרטי חברה להפקת המסמך",
            {"missing_fields": missing, "cta": "company_branding"},
        )
    company_snapshot = None
    frozen_pdf_template = None
    if status not in {"draft"}:
        version = int(quote.get("version") or 1)
        versions = as_list(
            client.get(
                "quote_versions",
                params={
                    "quote_id": f"eq.{quote['id']}",
                    "workspace_id": f"eq.{workspace_id}",
                    "version": f"eq.{version}",
                    "select": "snapshot",
                    "limit": "1",
                },
            )
        )
        if versions:
            snap = versions[0].get("snapshot") if isinstance(versions[0].get("snapshot"), dict) else {}
            public = snap.get("public") if isinstance(snap.get("public"), dict) else {}
            if isinstance(public.get("company_snapshot"), dict) and public.get("company_snapshot"):
                company_snapshot = public["company_snapshot"]
            elif isinstance(public.get("company"), dict) and public.get("company"):
                # Legacy sent snapshots: freeze the company block that was issued
                company_snapshot = public["company"]
            if isinstance(public.get("pdf_template"), dict):
                frozen_pdf_template = public["pdf_template"]

    pdf_tpl = _load_default_pdf_template(client, workspace_id)
    pdf_template = frozen_pdf_template
    if pdf_template is None and pdf_tpl:
        config = pdf_tpl.get("config") if isinstance(pdf_tpl.get("config"), dict) else {}
        pdf_template = {
            "id": pdf_tpl.get("id"),
            "name": pdf_tpl.get("name"),
            **config,
        }
        merge_quote_pdf_template_defaults(pdf_template, quotes_cfg=quotes_cfg, config=config)
    elif pdf_template is None:
        pdf_template = {}
        merge_quote_pdf_template_defaults(pdf_template, quotes_cfg=quotes_cfg, config={})
    quote_doc = {**quote, **_pricing_breakdown(quote, items, sections)}
    return public_payload(
        quote_doc,
        items,
        workspace=workspace,
        customer=customer,
        site=site,
        sections=sections,
        branding=branding,
        company_snapshot=company_snapshot,
        pdf_template=pdf_template,
        freeze_company=bool(company_snapshot) or status not in {"draft"},
    )


def _quote_list_filter_params(
    *,
    workspace_id: UUID,
    client: UserClient,
    q: str | None,
    status: str | None,
    exclude_status: str | None,
    customer_id: str | None,
    lead_id: str | None,
    site_id: str | None,
    visibility: VisibilityMode = "active",
) -> dict[str, str]:
    params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        **quote_visibility_filters(visibility),
        "select": QUOTE_LIST_SELECT,
        "order": "created_at.desc",
    }
    if exclude_status:
        excluded = [part.strip() for part in exclude_status.split(",") if part.strip()]
        if len(excluded) == 1:
            status_filter = f"status.neq.{excluded[0]}"
        elif excluded:
            status_filter = f"status.not.in.({','.join(excluded)})"
        else:
            status_filter = None
    elif status:
        statuses = [part.strip() for part in status.split(",") if part.strip()]
        if len(statuses) == 1:
            status_filter = f"status.eq.{statuses[0]}"
        elif statuses:
            status_filter = f"status.in.({','.join(statuses)})"
        else:
            status_filter = None
    else:
        status_filter = None

    if customer_id:
        params["customer_id"] = f"eq.{customer_id}"
    if lead_id:
        params["lead_id"] = f"eq.{lead_id}"
    if site_id:
        params["site_id"] = f"eq.{site_id}"

    search_or = None
    if q:
        safe = sanitize_search_q(q)
        if safe:
            clauses = [
                f"number.ilike.*{safe}*",
                f"title.ilike.*{safe}*",
                f"project_name.ilike.*{safe}*",
            ]
            customer_ids = _customer_ids_matching_name(client, workspace_id, safe)
            if customer_ids:
                clauses.append(f"customer_id.in.({','.join(customer_ids)})")
            search_or = f"({','.join(clauses)})"

    if status_filter and search_or:
        _col, _sep, op_value = status_filter.partition(".")
        params["status"] = op_value
        params["or"] = search_or
    elif status_filter:
        _col, _sep, op_value = status_filter.partition(".")
        params["status"] = op_value
    elif search_or:
        params["or"] = search_or
    return params


def _resolve_visibility(
    *,
    archived: bool | None,
    include_archived: bool | None,
) -> VisibilityMode:
    if archived:
        return "archived"
    if include_archived:
        return "all_alive"
    return "active"


@router.get("/quotes")
def list_quotes(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    limit: int | None = Query(default=50),
    cursor: str | None = Query(default=None),
    q: str | None = Query(default=None),
    status: str | None = Query(default=None),
    exclude_status: str | None = Query(default=None),
    customer_id: str | None = Query(default=None),
    lead_id: str | None = Query(default=None),
    site_id: str | None = Query(default=None),
    archived: bool | None = Query(default=None),
    include_archived: bool | None = Query(default=None),
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "quotes.view")
    page_size = parse_limit(limit)
    visibility = _resolve_visibility(archived=archived, include_archived=include_archived)
    params = _quote_list_filter_params(
        workspace_id=workspace_id,
        client=client,
        q=q,
        status=status,
        exclude_status=exclude_status,
        customer_id=customer_id,
        lead_id=lead_id,
        site_id=site_id,
        visibility=visibility,
    )
    params["limit"] = str(page_size + 1)
    before = decode_cursor(cursor)
    if before:
        params["created_at"] = f"lt.{before}"
    rows = as_list(client.get("quotes", params=params))
    page = page_from_rows(rows, page_size)
    show_cost = _can_view_cost(ctx)
    if show_cost and page.items:
        ids = [str(row["id"]) for row in page.items if row.get("id")]
        if ids:
            cost_rows = as_list(
                _service().get(
                    "quotes",
                    params={
                        "workspace_id": f"eq.{workspace_id}",
                        "id": f"in.({','.join(ids)})",
                        "select": QUOTE_LIST_COST_SELECT,
                    },
                )
            )
            by_id = {str(r["id"]): r for r in cost_rows}
            for row in page.items:
                extra = by_id.get(str(row["id"]))
                if extra:
                    row["cost_total"] = extra.get("cost_total")
                    row["margin_amount"] = extra.get("margin_amount")
                    row["margin_percent"] = extra.get("margin_percent")
    items = [_strip_cost(_flatten_quote(row), [], show_cost=show_cost) for row in page.items]
    # KPI strip always reflects the active (non-archived) pipeline.
    count_rows = as_list(
        client.get(
            "quotes",
            params={
                "workspace_id": f"eq.{workspace_id}",
                **quote_visibility_filters("active"),
                "select": "status,total_gross",
            },
        )
    )
    return {
        "items": items,
        "next_cursor": page.next_cursor,
        "counts": _quote_list_counts(count_rows),
    }


@router.get("/quotes/export")
def export_quotes_csv(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    q: str | None = Query(default=None),
    status: str | None = Query(default=None),
    exclude_status: str | None = Query(default=None),
    customer_id: str | None = Query(default=None),
    lead_id: str | None = Query(default=None),
    site_id: str | None = Query(default=None),
    archived: bool | None = Query(default=None),
    include_archived: bool | None = Query(default=None),
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "quotes.export")
    show_cost = _can_view_cost(ctx)
    visibility = _resolve_visibility(archived=archived, include_archived=include_archived)
    params = _quote_list_filter_params(
        workspace_id=workspace_id,
        client=client,
        q=q,
        status=status,
        exclude_status=exclude_status,
        customer_id=customer_id,
        lead_id=lead_id,
        site_id=site_id,
        visibility=visibility,
    )
    collected: list[dict] = []
    cursor: str | None = None
    truncated = False
    while len(collected) < EXPORT_MAX:
        page_params = dict(params)
        page_params["limit"] = str(EXPORT_PAGE + 1)
        if cursor:
            page_params["created_at"] = f"lt.{cursor}"
        rows = as_list(client.get("quotes", params=page_params))
        page = page_from_rows(rows, EXPORT_PAGE)
        collected.extend(page.items)
        if not page.next_cursor:
            break
        if len(collected) >= EXPORT_MAX:
            truncated = True
            break
        cursor = page.next_cursor
    if show_cost and collected:
        ids = [str(row["id"]) for row in collected if row.get("id")]
        cost_by_id: dict[str, dict] = {}
        for i in range(0, len(ids), 100):
            chunk = ids[i : i + 100]
            cost_rows = as_list(
                _service().get(
                    "quotes",
                    params={
                        "workspace_id": f"eq.{workspace_id}",
                        "id": f"in.({','.join(chunk)})",
                        "select": QUOTE_LIST_COST_SELECT,
                    },
                )
            )
            cost_by_id.update({str(r["id"]): r for r in cost_rows})
        for row in collected:
            extra = cost_by_id.get(str(row["id"]))
            if extra:
                row["cost_total"] = extra.get("cost_total")
                row["margin_amount"] = extra.get("margin_amount")
                row["margin_percent"] = extra.get("margin_percent")
    items = [_strip_cost(_flatten_quote(row), [], show_cost=show_cost) for row in collected]
    headers = ["מספר", "סטטוס", "לקוח", "אתר", "כותרת", "סכום", "מטבע", "נוצר", "בתוקף עד"]
    if show_cost:
        headers.extend(["עלות", "מרווח", "אחוז מרווח"])
    csv_rows: list[list[object]] = []
    for item in items:
        row = [
            item.get("number"),
            QUOTE_STATUS_HE.get(str(item.get("status") or ""), item.get("status")),
            item.get("customer_name"),
            item.get("site_name"),
            item.get("title") or item.get("project_name"),
            item.get("total_gross"),
            item.get("currency"),
            item.get("created_at"),
            item.get("valid_until"),
        ]
        if show_cost:
            row.extend([item.get("cost_total"), item.get("margin_amount"), item.get("margin_percent")])
        csv_rows.append(row)
    write_audit(
        client,
        str(workspace_id),
        "quotes.export",
        entity_type="quote",
        metadata={"row_count": len(csv_rows), "truncated": truncated, "max_rows": EXPORT_MAX},
    )
    return csv_response(
        build_csv(headers, csv_rows),
        "הצעות-מחיר.csv",
        row_count=len(csv_rows),
        truncated=truncated,
    )


@router.post("/quotes")
def create_quote(
    workspace_id: UUID,
    body: QuoteCreate,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "quotes.create", resource=ResourceRef(type="quote", owner_user_id=actor_id(user)))
    raise_plan_limit(
        evaluate_count_limit(
            plan_key=ctx.plan_key,
            limit_key="quota_quotes",
            resource="quotes",
            current=fetch_quotes_count(client, str(workspace_id)),
        )
    )
    vat = body.vat_percent
    if vat is None:
        ws = _load_workspace(client, workspace_id)
        vat = float(ws.get("vat_percent") or 18)
    else:
        ws = _load_workspace(client, workspace_id)
    _assert_refs_in_workspace(client, workspace_id, body.model_dump())
    _assert_contact_belongs_to_customer(
        client,
        workspace_id,
        customer_id=body.customer_id,
        contact_id=body.contact_id,
    )
    settings = _load_quote_settings(client, workspace_id)
    quotes_cfg = settings.get("quotes") if isinstance(settings.get("quotes"), dict) else {}
    payload = {
        "workspace_id": str(workspace_id),
        "created_by": actor_id(user),
        "owner_user_id": actor_id(user),
        "vat_percent": vat,
        **body.model_dump(exclude_none=True, exclude={"vat_percent"}),
    }
    apply_quote_create_defaults(
        payload,
        quotes_cfg=quotes_cfg,
        timezone_name=ws.get("timezone"),
    )
    row = created_or_403(client.post("quotes", payload, params={"select": QUOTE_SELECT_SAFE}))
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
    # Allow explicit nulls for FK clears (customer/site/lead/contact replacement).
    clearable = {"customer_id", "contact_id", "site_id", "lead_id", "template_id"}
    raw = body.model_dump(exclude_unset=True)
    patch = {k: v for k, v in raw.items() if v is not None or k in clearable}
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", "אין מה לעדכן")
    _assert_refs_in_workspace(client, workspace_id, patch)
    if "contact_id" in patch or "customer_id" in patch:
        next_customer = patch["customer_id"] if "customer_id" in patch else existing.get("customer_id")
        next_contact = patch["contact_id"] if "contact_id" in patch else existing.get("contact_id")
        _assert_contact_belongs_to_customer(
            client,
            workspace_id,
            customer_id=next_customer,
            contact_id=next_contact,
        )
    if any(k in patch for k in ("total_gross", "subtotal_net", "vat_amount", "cost_total")):
        raise ApiError(400, "VALIDATION_ERROR", "סה״כ מחושב בשרת בלבד")
    row = patched_or_403(
        client.patch(
            "quotes",
            patch,
            params={
                "id": f"eq.{quote_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": QUOTE_SELECT_SAFE,
            },
        )
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
                "select": TEMPLATE_ITEM_SELECT,
                "order": "sort_order.asc",
            },
        )
    )
    if not template_items:
        raise ApiError(400, "TEMPLATE_EMPTY", MESSAGES["TEMPLATE_EMPTY"])
    existing_items = _load_items(client, workspace_id, quote_id)
    existing_sections = _load_sections(client, workspace_id, quote_id)
    sort_base = max((int(item.get("sort_order") or 0) for item in existing_items), default=0)
    section_sort_base = max((int(sec.get("sort_order") or 0) for sec in existing_sections), default=0)
    if section_sort_base:
        section_sort_base += 10
    else:
        section_sort_base = 10
    section_by_name: dict[str, str] = {}
    inserted = 0
    for index, row in enumerate(template_items, start=1):
        section_id, section_sort_base = _resolve_template_section_id(
            client,
            workspace_id,
            quote_id,
            row.get("section_name") if isinstance(row.get("section_name"), str) else None,
            section_by_name=section_by_name,
            existing_sections=existing_sections,
            next_sort=section_sort_base,
        )
        line_sort = sort_base + int(row.get("sort_order") or index * 10)
        body = _template_item_to_quote_item_in(row, sort_order=line_sort, section_id=section_id)
        if not body:
            continue
        ok = _insert_line(
            client,
            workspace_id,
            quote_id,
            body,
            ctx,
            allow_template_price=True,
        )
        if ok:
            inserted += 1
    if inserted == 0:
        raise ApiError(400, "TEMPLATE_EMPTY", MESSAGES["TEMPLATE_EMPTY"])
    patched = patched_or_403(
        client.patch(
            "quotes",
            {"template_id": template["id"]},
            params={
                "id": f"eq.{quote_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": QUOTE_SELECT_SAFE,
            },
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
        _service().get(
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
    if not before:
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    if "section_id" in patch:
        _assert_section_on_quote(client, workspace_id, quote_id, patch["section_id"])
    patched_or_403(
        _quote_writer().patch(
            "quote_items",
            patch,
            params={
                "id": f"eq.{item_id}",
                "quote_id": f"eq.{quote_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": ITEM_SELECT_SAFE,
            },
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
        prefer="return=minimal",
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
    row, items, token = _transition_to_sent(client, svc, user, workspace_id, existing, ctx=ctx)
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
    ctx=None,
) -> tuple[dict, list[dict], str]:
    """Validate, mark sent (conditional), snapshot, mint public token. Caller must authorize quotes.send.

    A3 concurrency: only one request may win draft→sent for the same id/workspace/version.
    Losers must not mint tokens or write publication side effects.
    """
    quote_id = UUID(str(existing["id"]))
    items = _load_items(client, workspace_id, quote_id)
    existing, items = _persist_totals(client, workspace_id, existing, items)
    workspace, _customer, _site = _related(client, workspace_id, existing)
    settings = _load_quote_settings(client, workspace_id)
    if ctx is not None:
        _assert_margin_allows_send(ctx, existing, settings)
    gaps = validate_for_send(existing, items, workspace, settings)
    if gaps:
        raise ApiError(400, "QUOTE_INCOMPLETE", MESSAGES["QUOTE_INCOMPLETE"], {"gaps": gaps})
    from ..quote_value_guard import assert_quote_has_billable_value

    assert_quote_has_billable_value(existing, items)
    soft = advisory_checks(existing, items, workspace, settings)
    _ = soft  # advisory only — never blocks send
    now = datetime.now(UTC).isoformat()
    version = int(existing.get("version") or 1)
    # Conditional publication boundary — must precede snapshot/token side effects.
    res = _quote_writer().patch(
        "quotes",
        {"status": "sent", "sent_at": now},
        params={
            "id": f"eq.{quote_id}",
            "workspace_id": f"eq.{workspace_id}",
            "status": "eq.draft",
            "version": f"eq.{version}",
            "select": QUOTE_SELECT_SAFE,
        },
    )
    rows = as_list(res) if res.status_code == 200 else []
    if not rows:
        # Another Send won, or quote left draft — do not snapshot/mint again.
        raise ApiError(
            403,
            "RESOURCE_STATE",
            MESSAGES["RESOURCE_STATE"],
            {"state": str(existing.get("status") or "unknown"), "reason": "send_already_published"},
        )
    row = rows[0]
    _upsert_version_snapshot(
        client,
        user,
        workspace_id,
        row,
        items,
        snapshot_status="sent",
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
    try_notify(notify_quote_event, svc, row, "quote.sent", actor_user_id=actor_id(user))
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
    if str(existing.get("status") or "") == "approved":
        raise ApiError(409, "QUOTE_APPROVED_LOCKED", MESSAGES["QUOTE_APPROVED_LOCKED"])
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
    current_status = str(existing.get("status") or "")
    current_version = int(existing.get("version") or 1)
    next_version = current_version + 1
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
    # Optimistic lock: only the request that still sees this status+version may reopen it.
    res = _quote_writer().patch(
        "quotes",
        patch,
        params={
            "id": f"eq.{quote_id}",
            "workspace_id": f"eq.{workspace_id}",
            "status": f"eq.{current_status}",
            "version": f"eq.{current_version}",
            "select": QUOTE_SELECT_SAFE,
        },
    )
    rows = as_list(res) if res.status_code == 200 else []
    if not rows:
        raise ApiError(409, "QUOTE_VERSION_CONFLICT", MESSAGES["QUOTE_VERSION_CONFLICT"])
    row = rows[0]
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
    """Mint (or re-mint) a secure customer view link.

    Creating a link must NOT mark the quote as sent. Formal publication is an
    explicit `/send` action only. Opening a draft Share link must not promote
    draft → sent (SHARE = VIEW).
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


_NON_DRAFT_DELETE_MSG = "לא ניתן למחוק הצעה שאינה טיוטה — יש לארכב אותה"


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
    status = str(existing.get("status") or "")
    if status != "draft":
        raise ApiError(
            409,
            "RESOURCE_STATE",
            _NON_DRAFT_DELETE_MSG,
            {"state": status, "hint": "archive"},
        )
    require(ctx, "quotes.delete", resource=_ref(existing))
    now = datetime.now(UTC).isoformat()
    patch: dict = {"deleted_at": now}
    _record_event(client, workspace_id, quote_id, "deleted", actor_id(user), {"from_status": status})
    write_audit(
        client,
        str(workspace_id),
        "quotes.delete",
        entity_type="quote",
        entity_id=str(quote_id),
        metadata={"from_status": status},
    )
    # SELECT RLS is `deleted_at IS NULL`. A user-JWT PATCH that stamps deleted_at
    # cannot RETURN the row; PostgREST answers 404 and the API used to surface 403.
    # authorize() already ran against the live row. Service role only stamps that id.
    # DB trigger quotes_enforce_delete_policy also blocks soft-delete of non-drafts.
    acked_or_403(
        svc.patch(
            "quotes",
            patch,
            params={"id": f"eq.{quote_id}", "workspace_id": f"eq.{workspace_id}"},
            prefer="return=minimal",
        )
    )
    # Soft-delete does not CASCADE; stamp Designs so they cannot remain independently visible.
    from ..system_designs import soft_delete_designs_for_quote

    soft_delete_designs_for_quote(svc, workspace_id, quote_id)
    try:
        _revoke_public_access(svc, workspace_id, quote_id)
    except Exception:
        pass
    return {"ok": True}


@router.post("/quotes/{quote_id}/archive")
def archive_quote(
    workspace_id: UUID,
    quote_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    svc: Annotated[ServiceClient, Depends(service_client)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    existing = _load_quote(client, workspace_id, quote_id)
    # Archive is allowed for non-draft; skip QUOTE_DELETABLE state gate via state=None.
    require(
        ctx,
        "quotes.delete",
        resource=ResourceRef(
            type="quote",
            id=str(existing["id"]),
            owner_user_id=existing.get("owner_user_id"),
            site_id=existing.get("site_id"),
        ),
    )
    if existing.get("archived_at"):
        raise ApiError(409, "RESOURCE_STATE", "ההצעה כבר בארכיון", {"state": "archived"})
    if str(existing.get("status") or "") == "draft":
        raise ApiError(
            409,
            "RESOURCE_STATE",
            "טיוטה נמחקת, לא מארכבת",
            {"state": "draft", "hint": "delete"},
        )
    now = datetime.now(UTC).isoformat()
    uid = actor_id(user)
    acked_or_403(
        svc.patch(
            "quotes",
            {"archived_at": now, "archived_by": uid},
            params={
                "id": f"eq.{quote_id}",
                "workspace_id": f"eq.{workspace_id}",
                "archived_at": "is.null",
            },
            prefer="return=minimal",
        )
    )
    _record_event(client, workspace_id, quote_id, "archived", uid, {"from_status": existing.get("status")})
    write_audit(
        client,
        str(workspace_id),
        "quotes.archive",
        entity_type="quote",
        entity_id=str(quote_id),
        metadata={"from_status": existing.get("status")},
    )
    return {"ok": True, "archived_at": now}


@router.post("/quotes/{quote_id}/restore")
def restore_quote(
    workspace_id: UUID,
    quote_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    svc: Annotated[ServiceClient, Depends(service_client)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    # Archived rows are still SELECT-visible under RLS (unlike soft-deleted).
    existing = _load_quote(client, workspace_id, quote_id)
    require(
        ctx,
        "quotes.delete",
        resource=ResourceRef(
            type="quote",
            id=str(existing["id"]),
            owner_user_id=existing.get("owner_user_id"),
            site_id=existing.get("site_id"),
        ),
    )
    if not existing.get("archived_at"):
        raise ApiError(409, "RESOURCE_STATE", "ההצעה אינה בארכיון", {"state": existing.get("status")})
    uid = actor_id(user)
    acked_or_403(
        svc.patch(
            "quotes",
            {"archived_at": None, "archived_by": None},
            params={
                "id": f"eq.{quote_id}",
                "workspace_id": f"eq.{workspace_id}",
                "archived_at": "not.is.null",
            },
            prefer="return=minimal",
        )
    )
    _record_event(client, workspace_id, quote_id, "restored", uid, {"from_status": existing.get("status")})
    write_audit(
        client,
        str(workspace_id),
        "quotes.restore",
        entity_type="quote",
        entity_id=str(quote_id),
        metadata={"from_status": existing.get("status")},
    )
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
    raise_plan_limit(
        evaluate_count_limit(
            plan_key=ctx.plan_key,
            limit_key="quota_quotes",
            resource="quotes",
            current=fetch_quotes_count(client, str(workspace_id)),
        )
    )
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
    row = created_or_403(client.post("quotes", payload, params={"select": QUOTE_SELECT_SAFE}))
    new_quote_id = UUID(row["id"])
    section_map: dict[str, str] = {}
    for section in _load_sections(client, workspace_id, quote_id):
        copy = created_or_403(
            client.post(
                "quote_sections",
                {
                    "workspace_id": str(workspace_id),
                    "quote_id": str(new_quote_id),
                    "name": section.get("name"),
                    "sort_order": section.get("sort_order") or 0,
                    "discount_type": section.get("discount_type"),
                    "discount_value": section.get("discount_value") or 0,
                },
            )
        )
        section_map[str(section["id"])] = str(copy["id"])
    # Service read keeps cost (SELECT on cost is revoked from authenticated).
    items = as_list(
        _service().get(
            "quote_items",
            params={
                "quote_id": f"eq.{quote_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": ITEM_SELECT,
                "order": "sort_order.asc",
            },
        )
    )
    writer = _quote_writer()
    for item in items:
        created_or_403(
            writer.post(
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
                    "section_id": section_map.get(str(item.get("section_id"))),
                    "package_instance_id": item.get("package_instance_id"),
                    "package_id": item.get("package_id"),
                    "package_name": item.get("package_name"),
                    "is_optional": bool(item.get("is_optional")),
                    "line_net": item.get("line_net") or 0,
                },
                params={"select": ITEM_SELECT_SAFE},
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
