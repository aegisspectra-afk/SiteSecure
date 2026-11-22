"""CPQ Phase 2 endpoints: sections, packages, templates save, revisions, audit, document."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field

from .. import pricing
from ..audit import write_audit
from ..authz.guard import require
from ..authz.types import ResourceRef
from ..deps import UserClient, current_user, load_authz_context, service_client, user_client
from ..errors import ApiError, MESSAGES
from ..identity import actor_id
from ..quote_validation import critical_gaps_only
from ..rest import as_list, created_or_403, one_or_404, patched_or_403
from ..supabase_service import ServiceClient
from .quotes import (
    ITEM_SELECT,
    QUOTE_SELECT_SAFE,
    QuoteItemIn,
    _can_view_cost,
    _ctx,
    _document_payload,
    _insert_line,
    _load_items,
    _load_quote,
    _persist_totals,
    _quote_writer,
    _record_event,
    _ref,
    _service,
    _with_validation,
)

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}", tags=["quote-cpq"])

SECTION_SELECT = (
    "id,quote_id,name,sort_order,discount_type,discount_value,collapsed,"
    "alternative_id,created_at,updated_at"
)
ALTERNATIVE_SELECT = (
    "id,workspace_id,quote_id,label,sort_order,is_recommended,customer_summary,created_at,updated_at"
)
DEFAULT_ALTERNATIVE_LABELS = ("בסיסי", "מומלץ", "מתקדם")
PACKAGE_SELECT = (
    "id,workspace_id,name,description,category,is_active,created_by,updated_by,created_at,updated_at"
)


def _package_out(row: dict) -> dict:
    out = dict(row)
    nested = out.pop("quote_package_items", None) or []
    count = 0
    if isinstance(nested, list) and nested and isinstance(nested[0], dict):
        count = int(nested[0].get("count") or 0)
    elif isinstance(nested, dict):
        count = int(nested.get("count") or 0)
    out["item_count"] = count
    return out


class SectionIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = "סעיף חדש"
    sort_order: int = 0
    discount_type: str = "amount"
    discount_value: float = Field(default=0, ge=0)
    collapsed: bool = False


class SectionPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = None
    sort_order: int | None = None
    discount_type: str | None = None
    discount_value: float | None = Field(default=None, ge=0)
    collapsed: bool | None = None


class PackageIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str
    description: str = ""
    category: str = "general"
    items: list[dict] = Field(default_factory=list)


class ApplyPackageIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    package_id: str
    section_id: str | None = None


class SaveTemplateIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    key: str | None = None
    name_he: str
    description: str = ""
    category: str = "general"
    include_terms: bool = True


class MarginOverrideIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: str = Field(min_length=3, max_length=500)


class ReviseIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: str | None = None


def _load_sections(client: UserClient, workspace_id: UUID, quote_id: UUID) -> list[dict]:
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


def _load_settings(client: UserClient, workspace_id: UUID) -> dict:
    rows = as_list(
        client.get(
            "workspace_settings",
            params={"workspace_id": f"eq.{workspace_id}", "select": "quotes,taxes,branding"},
        )
    )
    return rows[0] if rows else {}


def _enrich_quote(client: UserClient, workspace_id: UUID, quote: dict, items: list[dict], *, show_cost: bool) -> dict:
    sections = _load_sections(client, workspace_id, UUID(quote["id"]))
    settings = _load_settings(client, workspace_id)
    quotes_cfg = settings.get("quotes") if isinstance(settings.get("quotes"), dict) else {}
    out = _with_validation(client, workspace_id, quote, items, show_cost=show_cost)
    out["sections"] = sections
    out["quote_discount_amount"] = None
    computed = pricing.recalculate(
        items,
        vat_percent=quote.get("vat_percent"),
        discount_type=quote.get("discount_type"),
        discount_value=quote.get("discount_value"),
        sections=sections,
    )
    out["lines_subtotal"] = computed.get("lines_subtotal")
    out["section_discount_amount"] = computed.get("section_discount_amount")
    out["quote_discount_amount"] = computed.get("quote_discount_amount")
    if show_cost:
        out["margin_status"] = pricing.margin_status(
            quote.get("margin_percent"),
            target=quotes_cfg.get("margin_target", 30),
            minimum=quotes_cfg.get("margin_minimum", 15),
        )
        out["margin_target"] = float(quotes_cfg.get("margin_target", 30))
        out["margin_minimum"] = float(quotes_cfg.get("margin_minimum", 15))
    return out


@router.get("/quotes/{quote_id}/sections")
def list_sections(
    workspace_id: UUID,
    quote_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    existing = _load_quote(client, workspace_id, quote_id)
    require(ctx, "quotes.view", resource=_ref(existing))
    return {"items": _load_sections(client, workspace_id, quote_id)}


@router.post("/quotes/{quote_id}/sections")
def create_section(
    workspace_id: UUID,
    quote_id: UUID,
    body: SectionIn,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    existing = _load_quote(client, workspace_id, quote_id)
    require(ctx, "quotes.edit", resource=_ref(existing))
    dtype = body.discount_type if body.discount_type in {"amount", "percent", "fixed"} else "amount"
    row = created_or_403(
        client.post(
            "quote_sections",
            {
                "workspace_id": str(workspace_id),
                "quote_id": str(quote_id),
                "name": body.name.strip() or "סעיף",
                "sort_order": body.sort_order,
                "discount_type": dtype,
                "discount_value": body.discount_value,
                "collapsed": body.collapsed,
            },
        )
    )
    _record_event(client, workspace_id, quote_id, "section_added", actor_id(user), {"section_id": row["id"]})
    items = _load_items(client, workspace_id, quote_id)
    quote, items = _persist_totals(client, workspace_id, existing, items)
    return _enrich_quote(client, workspace_id, quote, items, show_cost=_can_view_cost(ctx)) | {
        "section": row
    }


@router.patch("/quotes/{quote_id}/sections/{section_id}")
def patch_section(
    workspace_id: UUID,
    quote_id: UUID,
    section_id: UUID,
    body: SectionPatch,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    existing = _load_quote(client, workspace_id, quote_id)
    require(ctx, "quotes.edit", resource=_ref(existing))
    patch = body.model_dump(exclude_none=True)
    if "discount_type" in patch and patch["discount_type"] not in {"amount", "percent", "fixed"}:
        raise ApiError(400, "VALIDATION_ERROR", "סוג הנחה לא תקין")
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", "אין מה לעדכן")
    patched_or_403(
        client.patch(
            "quote_sections",
            patch,
            params={
                "id": f"eq.{section_id}",
                "quote_id": f"eq.{quote_id}",
                "workspace_id": f"eq.{workspace_id}",
            },
        )
    )
    items = _load_items(client, workspace_id, quote_id)
    row, items = _persist_totals(client, workspace_id, existing, items)
    return _enrich_quote(client, workspace_id, row, items, show_cost=_can_view_cost(ctx))


@router.delete("/quotes/{quote_id}/sections/{section_id}")
def delete_section(
    workspace_id: UUID,
    quote_id: UUID,
    section_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    existing = _load_quote(client, workspace_id, quote_id)
    require(ctx, "quotes.edit", resource=_ref(existing))
    # Detach lines then delete section
    _quote_writer().patch(
        "quote_items",
        {"section_id": None},
        params={
            "section_id": f"eq.{section_id}",
            "quote_id": f"eq.{quote_id}",
            "workspace_id": f"eq.{workspace_id}",
        },
    )
    res = client.delete(
        "quote_sections",
        params={
            "id": f"eq.{section_id}",
            "quote_id": f"eq.{quote_id}",
            "workspace_id": f"eq.{workspace_id}",
        },
    )
    if res.status_code not in {200, 204}:
        raise ApiError(403, "PERMISSION_DENIED", "אין הרשאה לפעולה זו")
    _record_event(client, workspace_id, quote_id, "section_removed", actor_id(user), {"section_id": str(section_id)})
    items = _load_items(client, workspace_id, quote_id)
    row, items = _persist_totals(client, workspace_id, existing, items)
    return _enrich_quote(client, workspace_id, row, items, show_cost=_can_view_cost(ctx))


@router.post("/quotes/{quote_id}/sections/{section_id}/duplicate")
def duplicate_section(
    workspace_id: UUID,
    quote_id: UUID,
    section_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    existing = _load_quote(client, workspace_id, quote_id)
    require(ctx, "quotes.edit", resource=_ref(existing))
    source = one_or_404(
        client.get(
            "quote_sections",
            params={
                "id": f"eq.{section_id}",
                "quote_id": f"eq.{quote_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": SECTION_SELECT,
            },
        )
    )
    sections = _load_sections(client, workspace_id, quote_id)
    sort_base = max((int(s.get("sort_order") or 0) for s in sections), default=0) + 10
    new_section = created_or_403(
        client.post(
            "quote_sections",
            {
                "workspace_id": str(workspace_id),
                "quote_id": str(quote_id),
                "name": f"{source.get('name') or 'סעיף'} (העתק)",
                "sort_order": sort_base,
                "discount_type": source.get("discount_type") or "amount",
                "discount_value": source.get("discount_value") or 0,
                "collapsed": False,
            },
        )
    )
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
    item_sort = max((int(i.get("sort_order") or 0) for i in items), default=0)
    for item in items:
        if str(item.get("section_id") or "") != str(section_id):
            continue
        item_sort += 10
        payload = {
            "workspace_id": str(workspace_id),
            "quote_id": str(quote_id),
            "product_id": item.get("product_id"),
            "item_type": item.get("item_type") or "free",
            "description": item.get("description") or "",
            "qty": item.get("qty") or 0,
            "unit_price": item.get("unit_price") or 0,
            "cost": item.get("cost") or 0,
            "discount": item.get("discount") or 0,
            "discount_type": item.get("discount_type") or "amount",
            "sort_order": item_sort,
            "sku": item.get("sku"),
            "name": item.get("name"),
            "unit": item.get("unit"),
            "catalog_snapshot": item.get("catalog_snapshot") or {},
            "section_id": new_section["id"],
            "package_instance_id": item.get("package_instance_id"),
            "package_id": item.get("package_id"),
            "package_name": item.get("package_name"),
            "is_optional": bool(item.get("is_optional")),
            "line_net": item.get("line_net") or 0,
        }
        created_or_403(writer.post("quote_items", payload))
    items = _load_items(client, workspace_id, quote_id)
    row, items = _persist_totals(client, workspace_id, existing, items)
    return _enrich_quote(client, workspace_id, row, items, show_cost=_can_view_cost(ctx))


@router.get("/catalog/packages")
def list_packages(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "quotes.view")
    rows = as_list(
        client.get(
            "quote_packages",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "is_active": "eq.true",
                "select": f"{PACKAGE_SELECT},quote_package_items(count)",
                "order": "name.asc",
            },
        )
    )
    return {"items": [_package_out(row) for row in rows]}


@router.post("/catalog/packages")
def create_package(
    workspace_id: UUID,
    body: PackageIn,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "quotes.override_price")
    actor = actor_id(user)
    pkg = created_or_403(
        client.post(
            "quote_packages",
            {
                "workspace_id": str(workspace_id),
                "name": body.name.strip(),
                "description": body.description.strip(),
                "category": body.category.strip() or "general",
                "is_active": True,
                "created_by": actor,
                "updated_by": actor,
            },
        )
    )
    for index, raw in enumerate(body.items):
        product_id = raw.get("product_id")
        if not product_id:
            continue
        created_or_403(
            client.post(
                "quote_package_items",
                {
                    "workspace_id": str(workspace_id),
                    "package_id": pkg["id"],
                    "product_id": str(product_id),
                    "description": str(raw.get("description") or ""),
                    "qty": float(raw.get("qty") or 1),
                    "sort_order": int(raw.get("sort_order") or (index + 1) * 10),
                },
            )
        )
    return pkg


@router.post("/quotes/{quote_id}/apply-package")
def apply_package(
    workspace_id: UUID,
    quote_id: UUID,
    body: ApplyPackageIn,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    existing = _load_quote(client, workspace_id, quote_id)
    require(ctx, "quotes.edit", resource=_ref(existing))
    pkg = one_or_404(
        client.get(
            "quote_packages",
            params={
                "id": f"eq.{body.package_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": PACKAGE_SELECT,
            },
        )
    )
    pkg_items = as_list(
        client.get(
            "quote_package_items",
            params={
                "package_id": f"eq.{pkg['id']}",
                "workspace_id": f"eq.{workspace_id}",
                "select": "product_id,description,qty,sort_order",
                "order": "sort_order.asc",
            },
        )
    )
    if not pkg_items:
        raise ApiError(400, "TEMPLATE_EMPTY", "החבילה ריקה או ללא מוצרים בקטלוג")
    instance_id = str(uuid4())
    existing_items = _load_items(client, workspace_id, quote_id)
    sort_base = max((int(item.get("sort_order") or 0) for item in existing_items), default=0)
    inserted = 0
    for index, row in enumerate(pkg_items, start=1):
        product_id = row.get("product_id")
        if not product_id:
            continue
        ok = _insert_line(
            client,
            workspace_id,
            quote_id,
            QuoteItemIn(
                product_id=str(product_id),
                item_type="catalog",
                description=str(row.get("description") or ""),
                qty=float(row.get("qty") or 1),
                sort_order=sort_base + (index * 10),
                section_id=body.section_id,
                package_instance_id=instance_id,
                package_id=str(pkg["id"]),
                package_name=str(pkg.get("name") or ""),
            ),
            ctx,
        )
        if ok:
            inserted += 1
    if inserted == 0:
        raise ApiError(400, "TEMPLATE_EMPTY", "לא נוספו שורות מהחבילה — בדקו קטלוג")
    _record_event(
        client,
        workspace_id,
        quote_id,
        "package_applied",
        actor_id(user),
        {"package_id": pkg["id"], "instance_id": instance_id, "lines": inserted},
    )
    items = _load_items(client, workspace_id, quote_id)
    row, items = _persist_totals(client, workspace_id, existing, items)
    return _enrich_quote(client, workspace_id, row, items, show_cost=_can_view_cost(ctx))


@router.post("/quotes/{quote_id}/save-as-package")
def save_quote_as_package(
    workspace_id: UUID,
    quote_id: UUID,
    body: PackageIn,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    existing = _load_quote(client, workspace_id, quote_id)
    require(ctx, "quotes.view", resource=_ref(existing))
    require(ctx, "quotes.override_price")
    items = _load_items(client, workspace_id, quote_id)
    catalog_lines = [
        {
            "product_id": item.get("product_id"),
            "description": item.get("description") or item.get("name") or "",
            "qty": item.get("qty") or 1,
            "sort_order": item.get("sort_order") or 0,
        }
        for item in items
        if item.get("product_id") and (item.get("item_type") or "") != "note"
    ]
    if not catalog_lines:
        raise ApiError(400, "VALIDATION_ERROR", "אין שורות קטלוג לשמירה כחבילה")
    return create_package(
        workspace_id,
        PackageIn(
            name=body.name,
            description=body.description,
            category=body.category,
            items=catalog_lines,
        ),
        client,
        user,
    )


@router.post("/quotes/{quote_id}/save-as-template")
def save_quote_as_template(
    workspace_id: UUID,
    quote_id: UUID,
    body: SaveTemplateIn,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    """Save structure only — never customer PII."""
    ctx = _ctx(client, user, workspace_id)
    existing = _load_quote(client, workspace_id, quote_id)
    require(ctx, "quotes.view", resource=_ref(existing))
    require(ctx, "quotes.override_price")
    items = _load_items(client, workspace_id, quote_id)
    sections = {s["id"]: s for s in _load_sections(client, workspace_id, quote_id)}
    actor = actor_id(user)
    key = (body.key or body.name_he).strip().lower().replace(" ", "_")[:64]
    payload = {
        "workspace_id": str(workspace_id),
        "key": key,
        "name_he": body.name_he.strip(),
        "description": body.description.strip(),
        "category": body.category.strip() or "general",
        "is_active": True,
        "created_by": actor,
        "updated_by": actor,
    }
    if body.include_terms:
        payload["default_payment_terms"] = existing.get("payment_terms")
        payload["default_warranty"] = existing.get("warranty")
        payload["default_general_terms"] = existing.get("general_terms")
        # intentionally NOT customer_notes / addresses / phones
    tmpl = created_or_403(client.post("quote_templates", payload))
    for index, item in enumerate(items):
        if (item.get("item_type") or "") == "note":
            continue
        section_name = None
        sid = item.get("section_id")
        if sid and str(sid) in sections:
            section_name = sections[str(sid)].get("name")
        created_or_403(
            client.post(
                "quote_template_items",
                {
                    "workspace_id": str(workspace_id),
                    "template_id": tmpl["id"],
                    "product_id": item.get("product_id"),
                    "description": item.get("description") or item.get("name") or "",
                    "qty": item.get("qty") or 1,
                    "sort_order": int(item.get("sort_order") or (index + 1) * 10),
                    "section_name": section_name,
                    "unit_price": item.get("unit_price"),
                    "discount": item.get("discount") or 0,
                    "discount_type": item.get("discount_type") or "amount",
                    "item_type": item.get("item_type") or "catalog",
                },
            )
        )
    _record_event(
        client,
        workspace_id,
        quote_id,
        "template_saved",
        actor,
        {"template_id": tmpl["id"]},
    )
    write_audit(
        client,
        str(workspace_id),
        "quotes.save_template",
        entity_type="quote_template",
        entity_id=tmpl["id"],
        metadata={"source_quote_id": str(quote_id)},
    )
    return tmpl


@router.post("/quotes/{quote_id}/margin-override")
def margin_override(
    workspace_id: UUID,
    quote_id: UUID,
    body: MarginOverrideIn,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    existing = _load_quote(client, workspace_id, quote_id)
    require(ctx, "quotes.edit", resource=_ref(existing))
    require(ctx, "quotes.override_price")
    now = datetime.now(UTC).isoformat()
    actor = actor_id(user)
    row = patched_or_403(
        _quote_writer().patch(
            "quotes",
            {
                "margin_override_reason": body.reason.strip(),
                "margin_override_by": actor,
                "margin_override_at": now,
            },
            params={
                "id": f"eq.{quote_id}",
                "workspace_id": f"eq.{workspace_id}",
                "status": "eq.draft",
                "select": QUOTE_SELECT_SAFE,
            },
        )
    )
    _record_event(
        client,
        workspace_id,
        quote_id,
        "margin_override",
        actor,
        {"reason": body.reason.strip(), "margin_percent": existing.get("margin_percent")},
    )
    write_audit(
        client,
        str(workspace_id),
        "quotes.margin_override",
        entity_type="quote",
        entity_id=str(quote_id),
        metadata={"reason": body.reason.strip()},
    )
    items = _load_items(client, workspace_id, quote_id)
    return _enrich_quote(client, workspace_id, row, items, show_cost=_can_view_cost(ctx))


@router.get("/quotes/{quote_id}/versions")
def list_versions(
    workspace_id: UUID,
    quote_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    existing = _load_quote(client, workspace_id, quote_id)
    require(ctx, "quotes.view", resource=_ref(existing))
    rows = as_list(
        client.get(
            "quote_versions",
            params={
                "quote_id": f"eq.{quote_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": "id,version,created_at,created_by",
                "order": "version.asc",
            },
        )
    )
    return {"items": rows, "current_version": existing.get("version") or 1}


def _load_version_row(client: UserClient, workspace_id: UUID, quote_id: UUID, version: int) -> dict | None:
    """Load a frozen version only when it belongs to this quote and workspace."""
    rows = as_list(
        client.get(
            "quote_versions",
            params={
                "quote_id": f"eq.{quote_id}",
                "workspace_id": f"eq.{workspace_id}",
                "version": f"eq.{version}",
                "select": "id,version,snapshot,created_at",
            },
        )
    )
    return rows[0] if rows else None


def _public_from_version_row(row: dict | None) -> dict | None:
    if not row:
        return None
    public = (row.get("snapshot") or {}).get("public")
    return public if isinstance(public, dict) else None


@router.get("/quotes/{quote_id}/versions/{version}/document")
def quote_version_document(
    workspace_id: UUID,
    quote_id: UUID,
    version: int,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    """Historical customer document from a frozen snapshot — never live rows."""
    ctx = _ctx(client, user, workspace_id)
    existing = _load_quote(client, workspace_id, quote_id)
    require(ctx, "quotes.view", resource=_ref(existing))
    row = _load_version_row(client, workspace_id, quote_id, version)
    public = _public_from_version_row(row)
    if not row or not public:
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    return {**public, "version": row.get("version"), "historical": True}


@router.get("/quotes/{quote_id}/versions/compare")
def compare_versions(
    workspace_id: UUID,
    quote_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    from_version: int = 1,
    to_version: int | None = None,
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    existing = _load_quote(client, workspace_id, quote_id)
    require(ctx, "quotes.view", resource=_ref(existing))
    to_ver = to_version or int(existing.get("version") or 1)

    left = _load_version_row(client, workspace_id, quote_id, from_version)
    right = _load_version_row(client, workspace_id, quote_id, to_ver)
    if to_ver == int(existing.get("version") or 1) and right is None:
        # Live draft vs last issued — synthesize right from live public shape
        items = _load_items(client, workspace_id, quote_id)
        right = {
            "version": to_ver,
            "snapshot": {"public": _document_payload(client, workspace_id, existing, items)},
        }
    if not left or not right:
        raise ApiError(404, "NOT_FOUND", "לא נמצאה גרסה להשוואה")

    def _lines(snap_row: dict) -> dict[str, dict]:
        public = (snap_row.get("snapshot") or {}).get("public") or {}
        out: dict[str, dict] = {}
        for item in public.get("items") or []:
            key = str(item.get("sku") or item.get("description") or item.get("id") or "")
            out[key] = item
        return out

    def _sections(public: dict) -> dict[str, dict]:
        out: dict[str, dict] = {}
        for section in public.get("sections") or []:
            sid = str(section.get("id") or "")
            if sid:
                out[sid] = section
        return out

    a = _lines(left)
    b = _lines(right)
    keys = sorted(set(a) | set(b))
    changes = []
    for key in keys:
        la, lb = a.get(key), b.get(key)
        if la and not lb:
            changes.append({"key": key, "change": "removed", "from": la, "to": None})
        elif lb and not la:
            changes.append({"key": key, "change": "added", "from": None, "to": lb})
        elif la and lb:
            qty_a, qty_b = float(la.get("qty") or 0), float(lb.get("qty") or 0)
            price_a, price_b = float(la.get("unit_price") or 0), float(lb.get("unit_price") or 0)
            disc_a, disc_b = float(la.get("discount") or 0), float(lb.get("discount") or 0)
            opt_a, opt_b = bool(la.get("is_optional")), bool(lb.get("is_optional"))
            if (
                qty_a != qty_b
                or price_a != price_b
                or la.get("description") != lb.get("description")
                or disc_a != disc_b
                or opt_a != opt_b
            ):
                changes.append(
                    {
                        "key": key,
                        "change": "modified",
                        "from": {
                            "qty": qty_a,
                            "unit_price": price_a,
                            "description": la.get("description"),
                            "discount": disc_a,
                            "is_optional": opt_a,
                        },
                        "to": {
                            "qty": qty_b,
                            "unit_price": price_b,
                            "description": lb.get("description"),
                            "discount": disc_b,
                            "is_optional": opt_b,
                        },
                    }
                )
    pub_a = (left.get("snapshot") or {}).get("public") or {}
    pub_b = (right.get("snapshot") or {}).get("public") or {}
    sa, sb = _sections(pub_a), _sections(pub_b)
    for sid in sorted(set(sa) | set(sb)):
        sec_a, sec_b = sa.get(sid), sb.get(sid)
        if sec_a and not sec_b:
            changes.append(
                {"key": f"section:{sid}", "change": "removed", "from": {"name": sec_a.get("name")}, "to": None}
            )
        elif sec_b and not sec_a:
            changes.append(
                {"key": f"section:{sid}", "change": "added", "from": None, "to": {"name": sec_b.get("name")}}
            )
        elif (sec_a or {}).get("name") != (sec_b or {}).get("name"):
            changes.append(
                {
                    "key": f"section:{sid}",
                    "change": "modified",
                    "from": {"name": (sec_a or {}).get("name")},
                    "to": {"name": (sec_b or {}).get("name")},
                }
            )
    return {
        "from_version": from_version,
        "to_version": to_ver,
        "total_from": pub_a.get("total_gross"),
        "total_to": pub_b.get("total_gross"),
        "changes": changes,
    }


@router.get("/quotes/{quote_id}/events")
def list_events(
    workspace_id: UUID,
    quote_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    existing = _load_quote(client, workspace_id, quote_id)
    require(ctx, "quotes.view", resource=_ref(existing))
    rows = as_list(
        client.get(
            "quote_events",
            params={
                "quote_id": f"eq.{quote_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": "id,event_type,actor_id,metadata,created_at",
                "order": "created_at.desc",
                "limit": "100",
            },
        )
    )
    return {"items": rows}


class QuoteEventIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    event_type: str = Field(min_length=2, max_length=64)
    metadata: dict = Field(default_factory=dict)


ALLOWLISTED_CLIENT_EVENTS = frozenset(
    {"preview_opened", "pdf_generated", "whatsapp_share_initiated", "share_link_copied"}
)


@router.post("/quotes/{quote_id}/events")
def create_quote_event(
    workspace_id: UUID,
    quote_id: UUID,
    body: QuoteEventIn,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    existing = _load_quote(client, workspace_id, quote_id)
    require(ctx, "quotes.view", resource=_ref(existing))
    event_type = body.event_type.strip()
    if event_type not in ALLOWLISTED_CLIENT_EVENTS:
        raise ApiError(400, "VALIDATION_ERROR", "סוג אירוע לא מורשה")
    meta = body.metadata if isinstance(body.metadata, dict) else {}
    _record_event(
        client,
        workspace_id,
        quote_id,
        event_type,
        actor_id(user),
        {**meta, "version": existing.get("version") or 1},
    )
    return {"ok": True, "event_type": event_type}


@router.get("/quotes/{quote_id}/document")
def quote_document(
    workspace_id: UUID,
    quote_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    """Normalized customer-facing document for preview/PDF (no cost/margin)."""
    ctx = _ctx(client, user, workspace_id)
    row = _load_quote(client, workspace_id, quote_id)
    require(ctx, "quotes.view", resource=_ref(row))
    items = _load_items(client, workspace_id, quote_id)
    return _document_payload(client, workspace_id, row, items)


@router.get("/quotes/{quote_id}/pdf")
def quote_pdf(
    workspace_id: UUID,
    quote_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    svc: Annotated[ServiceClient, Depends(service_client)],
    inline: bool = False,
):
    """Binary PDF from the same canonical document payload as preview/customer view."""
    from ..documents.logo import attach_logo_bytes, resolve_logo_bytes
    from ..pdf_response import pdf_response
    from ..quote_pdf import render_quote_pdf

    ctx = _ctx(client, user, workspace_id)
    row = _load_quote(client, workspace_id, quote_id)
    require(ctx, "quotes.view", resource=_ref(row))
    items = _load_items(client, workspace_id, quote_id)
    document = _document_payload(client, workspace_id, row, items)
    for banned in ("cost_total", "margin_amount", "margin_percent", "internal_notes", "cost"):
        document.pop(banned, None)
    logo = resolve_logo_bytes(
        company=document.get("company") if isinstance(document.get("company"), dict) else None,
        download_fn=svc.storage_download_bytes,
    )
    document = attach_logo_bytes(document, logo)
    pdf_bytes, filename = render_quote_pdf(document)
    _record_event(
        client,
        workspace_id,
        quote_id,
        "pdf_generated",
        actor_id(user),
        {"version": row.get("version") or 1, "filename": filename, "template_version": document.get("template_version")},
    )
    return pdf_response(pdf_bytes, filename, inline=inline)


# --- B3: ועד בית alternatives -------------------------------------------------


class AlternativeIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    label: str = Field(min_length=1, max_length=80)
    sort_order: int = Field(ge=1, le=3)
    is_recommended: bool = False
    customer_summary: str | None = Field(default=None, max_length=280)


class AlternativePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    label: str | None = Field(default=None, min_length=1, max_length=80)
    sort_order: int | None = Field(default=None, ge=1, le=3)
    is_recommended: bool | None = None
    customer_summary: str | None = Field(default=None, max_length=280)


def _load_alternatives(client: UserClient, workspace_id: UUID, quote_id: UUID) -> list[dict]:
    return as_list(
        client.get(
            "quote_alternatives",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "quote_id": f"eq.{quote_id}",
                "select": ALTERNATIVE_SELECT,
                "order": "sort_order.asc",
            },
        )
    )


def _load_sections(client: UserClient, workspace_id: UUID, quote_id: UUID) -> list[dict]:
    return as_list(
        client.get(
            "quote_sections",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "quote_id": f"eq.{quote_id}",
                "select": SECTION_SELECT,
                "order": "sort_order.asc",
            },
        )
    )


def _alternatives_with_totals(
    client: UserClient,
    workspace_id: UUID,
    quote: dict,
    *,
    show_cost: bool,
) -> list[dict]:
    alts = _load_alternatives(client, workspace_id, UUID(str(quote["id"])))
    if not alts:
        return []
    items = _load_items(client, workspace_id, UUID(str(quote["id"])))
    sections = _load_sections(client, workspace_id, UUID(str(quote["id"])))
    breakdown = pricing.recalculate_alternatives(
        items,
        alts,
        vat_percent=quote.get("vat_percent") or 17,
        discount_type=quote.get("discount_type"),
        discount_value=quote.get("discount_value") or 0,
        sections=sections,
    )
    by_id = {str(row["alternative_id"]): row for row in breakdown}
    out: list[dict] = []
    for alt in alts:
        row = dict(alt)
        totals = by_id.get(str(alt["id"]), {})
        row["subtotal_net"] = totals.get("subtotal_net", 0)
        row["vat_amount"] = totals.get("vat_amount", 0)
        row["total_gross"] = totals.get("total_gross", 0)
        if show_cost:
            row["cost_total"] = totals.get("cost_total", 0)
            row["margin_amount"] = totals.get("margin_amount", 0)
            row["margin_percent"] = totals.get("margin_percent", 0)
        out.append(row)
    return out


@router.get("/quotes/{quote_id}/alternatives")
def list_alternatives(
    workspace_id: UUID,
    quote_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    quote = _load_quote(client, workspace_id, quote_id)
    require(ctx, "quotes.view", resource=_ref(quote))
    show_cost = _can_view_cost(ctx)
    return {
        "presentation_mode": quote.get("presentation_mode") or "single",
        "approved_alternative_id": quote.get("approved_alternative_id"),
        "items": _alternatives_with_totals(client, workspace_id, quote, show_cost=show_cost),
    }


@router.post("/quotes/{quote_id}/alternatives/enable")
def enable_alternatives(
    workspace_id: UUID,
    quote_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    """Seed three default tiers (בסיסי / מומלץ / מתקדם) and switch presentation_mode."""
    ctx = _ctx(client, user, workspace_id)
    quote = _load_quote(client, workspace_id, quote_id)
    require(ctx, "quotes.edit", resource=_ref(quote))
    if quote.get("status") != "draft":
        raise ApiError(409, "QUOTE_NOT_DRAFT", MESSAGES.get("QUOTE_NOT_DRAFT", "ניתן לערוך רק טיוטה"))
    existing = _load_alternatives(client, workspace_id, quote_id)
    if len(existing) >= 3:
        _quote_writer().patch(
            "quotes",
            {"presentation_mode": "alternatives"},
            params={"id": f"eq.{quote_id}", "workspace_id": f"eq.{workspace_id}"},
        )
        return list_alternatives(workspace_id, quote_id, client, user)

    writer = _quote_writer()
    for idx, label in enumerate(DEFAULT_ALTERNATIVE_LABELS, start=1):
        if any(int(a.get("sort_order") or 0) == idx for a in existing):
            continue
        created_or_403(
            writer.post(
                "quote_alternatives",
                {
                    "id": str(uuid4()),
                    "workspace_id": str(workspace_id),
                    "quote_id": str(quote_id),
                    "label": label,
                    "sort_order": idx,
                    "is_recommended": idx == 2,
                    "customer_summary": None,
                },
                params={"select": ALTERNATIVE_SELECT},
            )
        )
    writer.patch(
        "quotes",
        {"presentation_mode": "alternatives"},
        params={"id": f"eq.{quote_id}", "workspace_id": f"eq.{workspace_id}", "select": "id"},
    )
    _record_event(client, workspace_id, quote_id, "alternatives_enabled", actor_id(user), {})
    return list_alternatives(workspace_id, quote_id, client, user)


@router.post("/quotes/{quote_id}/alternatives")
def create_alternative(
    workspace_id: UUID,
    quote_id: UUID,
    body: AlternativeIn,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    quote = _load_quote(client, workspace_id, quote_id)
    require(ctx, "quotes.edit", resource=_ref(quote))
    if quote.get("status") != "draft":
        raise ApiError(409, "QUOTE_NOT_DRAFT", MESSAGES.get("QUOTE_NOT_DRAFT", "ניתן לערוך רק טיוטה"))
    existing = _load_alternatives(client, workspace_id, quote_id)
    if len(existing) >= 3:
        raise ApiError(400, "VALIDATION_ERROR", "ניתן להוסיף עד 3 חלופות להצעה")
    if any(int(a.get("sort_order") or 0) == body.sort_order for a in existing):
        raise ApiError(400, "VALIDATION_ERROR", "סדר החלופה כבר תפוס")
    if body.is_recommended:
        writer = _quote_writer()
        for alt in existing:
            if alt.get("is_recommended"):
                writer.patch(
                    "quote_alternatives",
                    {"is_recommended": False},
                    params={"id": f"eq.{alt['id']}", "workspace_id": f"eq.{workspace_id}"},
                )
    row = created_or_403(
        _quote_writer().post(
            "quote_alternatives",
            {
                "id": str(uuid4()),
                "workspace_id": str(workspace_id),
                "quote_id": str(quote_id),
                "label": body.label.strip(),
                "sort_order": body.sort_order,
                "is_recommended": body.is_recommended,
                "customer_summary": (body.customer_summary or "").strip() or None,
            },
            params={"select": ALTERNATIVE_SELECT},
        )
    )
    _quote_writer().patch(
        "quotes",
        {"presentation_mode": "alternatives"},
        params={"id": f"eq.{quote_id}", "workspace_id": f"eq.{workspace_id}"},
    )
    return row


@router.patch("/quotes/{quote_id}/alternatives/{alternative_id}")
def patch_alternative(
    workspace_id: UUID,
    quote_id: UUID,
    alternative_id: UUID,
    body: AlternativePatch,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    quote = _load_quote(client, workspace_id, quote_id)
    require(ctx, "quotes.edit", resource=_ref(quote))
    if quote.get("status") != "draft":
        raise ApiError(409, "QUOTE_NOT_DRAFT", MESSAGES.get("QUOTE_NOT_DRAFT", "ניתן לערוך רק טיוטה"))
    patch = body.model_dump(exclude_unset=True)
    if "label" in patch and patch["label"] is not None:
        patch["label"] = str(patch["label"]).strip()
    if patch.get("is_recommended") is True:
        for alt in _load_alternatives(client, workspace_id, quote_id):
            if str(alt["id"]) != str(alternative_id) and alt.get("is_recommended"):
                _quote_writer().patch(
                    "quote_alternatives",
                    {"is_recommended": False},
                    params={"id": f"eq.{alt['id']}", "workspace_id": f"eq.{workspace_id}"},
                )
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", "אין שינויים")
    patch["updated_at"] = datetime.now(UTC).isoformat()
    return patched_or_403(
        _quote_writer().patch(
            "quote_alternatives",
            patch,
            params={
                "id": f"eq.{alternative_id}",
                "quote_id": f"eq.{quote_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": ALTERNATIVE_SELECT,
            },
        )
    )


class GenerateCctvAlternativesIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    variant_axis: str = "resolution"  # resolution | retention


_CCTV_AXIS_SUMMARIES = {
    "resolution": ("רזולוציה 2MP", "רזולוציה 4MP", "רזולוציה 8MP"),
    "retention": ("הקלטה 7 ימים", "הקלטה 14 ימים", "הקלטה 30 ימים"),
}


@router.post("/quotes/{quote_id}/cctv/generate-alternatives")
def generate_cctv_alternatives(
    workspace_id: UUID,
    quote_id: UUID,
    body: GenerateCctvAlternativesIn,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    """B3: seed 3 ועד-בית tiers from CCTV axis and clone base lines into each tier.

    Starts from unscoped / recommended lines so the office can edit prices per tier.
    Full re-recommend (catalog swap by MP) remains available via the CCTV wizard apply.
    """
    ctx = _ctx(client, user, workspace_id)
    quote = _load_quote(client, workspace_id, quote_id)
    require(ctx, "quotes.edit", resource=_ref(quote))
    if quote.get("status") != "draft":
        raise ApiError(409, "QUOTE_NOT_DRAFT", MESSAGES.get("QUOTE_NOT_DRAFT", "ניתן לערוך רק טיוטה"))
    axis = (body.variant_axis or "resolution").strip().lower()
    if axis not in _CCTV_AXIS_SUMMARIES:
        raise ApiError(400, "VALIDATION_ERROR", "ציר חלופה לא תקין (resolution / retention)")

    # Ensure three tiers exist.
    enable_alternatives(workspace_id, quote_id, client, user)
    alts = _load_alternatives(client, workspace_id, quote_id)
    alts_sorted = sorted(alts, key=lambda a: int(a.get("sort_order") or 0))
    summaries = _CCTV_AXIS_SUMMARIES[axis]
    writer = _quote_writer()
    for alt, summary in zip(alts_sorted[:3], summaries, strict=False):
        writer.patch(
            "quote_alternatives",
            {"customer_summary": summary, "updated_at": datetime.now(UTC).isoformat()},
            params={
                "id": f"eq.{alt['id']}",
                "quote_id": f"eq.{quote_id}",
                "workspace_id": f"eq.{workspace_id}",
            },
        )

    items = _load_items(client, workspace_id, quote_id)
    recommended = next((a for a in alts_sorted if a.get("is_recommended")), alts_sorted[0] if alts_sorted else None)
    if not recommended:
        return list_alternatives(workspace_id, quote_id, client, user)

    recommended_id = str(recommended["id"])
    source_items = [
        it
        for it in items
        if it.get("item_type") != "note"
        and (
            not it.get("alternative_id")
            or str(it.get("alternative_id")) == recommended_id
        )
    ]

    # Bind unscoped lines to the recommended tier.
    for it in source_items:
        if not it.get("alternative_id"):
            writer.patch(
                "quote_items",
                {"alternative_id": recommended_id},
                params={
                    "id": f"eq.{it['id']}",
                    "quote_id": f"eq.{quote_id}",
                    "workspace_id": f"eq.{workspace_id}",
                },
            )
            it["alternative_id"] = recommended_id

    cloned = 0
    target_alts = [a for a in alts_sorted if str(a["id"]) != recommended_id]
    # Avoid double-cloning when target already has lines.
    existing_by_alt: dict[str, set[str]] = {}
    for it in items:
        aid = str(it.get("alternative_id") or "")
        if not aid:
            continue
        key = f"{it.get('product_id') or ''}|{it.get('description') or ''}|{it.get('qty')}"
        existing_by_alt.setdefault(aid, set()).add(key)

    for target in target_alts:
        tid = str(target["id"])
        for src in source_items:
            key = f"{src.get('product_id') or ''}|{src.get('description') or ''}|{src.get('qty')}"
            if key in existing_by_alt.get(tid, set()):
                continue
            ok = _insert_line(
                client,
                workspace_id,
                quote_id,
                QuoteItemIn(
                    product_id=str(src["product_id"]) if src.get("product_id") else None,
                    item_type=src.get("item_type") or "free",
                    description=src.get("description") or "",
                    sku=src.get("sku"),
                    name=src.get("name"),
                    qty=float(src.get("qty") or 1),
                    unit_price=float(src.get("unit_price") or 0),
                    cost=None,
                    discount=float(src.get("discount") or 0),
                    discount_type=src.get("discount_type") or "percent",
                    sort_order=int(src.get("sort_order") or 0),
                    section_id=str(src["section_id"]) if src.get("section_id") else None,
                    package_instance_id=(
                        str(src["package_instance_id"]) if src.get("package_instance_id") else None
                    ),
                    package_id=str(src["package_id"]) if src.get("package_id") else None,
                    package_name=src.get("package_name"),
                    is_optional=bool(src.get("is_optional")),
                    alternative_id=tid,
                ),
                ctx,
                allow_template_price=True,
            )
            if ok:
                cloned += 1
                existing_by_alt.setdefault(tid, set()).add(key)

    quote = _load_quote(client, workspace_id, quote_id)
    items = _load_items(client, workspace_id, quote_id)
    _persist_totals(client, workspace_id, quote, items)
    _record_event(
        client,
        workspace_id,
        quote_id,
        "cctv_alternatives_generated",
        actor_id(user),
        {"variant_axis": axis, "cloned_line_count": cloned},
    )
    out = list_alternatives(workspace_id, quote_id, client, user)
    out["cloned_line_count"] = cloned
    return out
