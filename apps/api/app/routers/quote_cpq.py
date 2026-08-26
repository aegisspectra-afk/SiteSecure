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
from ..deps import UserClient, current_user, load_authz_context, user_client
from ..errors import ApiError, MESSAGES
from ..identity import actor_id
from ..quote_validation import critical_gaps_only
from ..rest import as_list, created_or_403, one_or_404, patched_or_403
from .quotes import (
    ITEM_SELECT,
    QuoteItemIn,
    _can_view_cost,
    _ctx,
    _document_payload,
    _insert_line,
    _load_items,
    _load_quote,
    _persist_totals,
    _record_event,
    _ref,
    _with_validation,
)

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}", tags=["quote-cpq"])

SECTION_SELECT = (
    "id,quote_id,name,sort_order,discount_type,discount_value,collapsed,created_at,updated_at"
)
PACKAGE_SELECT = (
    "id,workspace_id,name,description,category,is_active,created_by,updated_by,created_at,updated_at"
)


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
    return _enrich_quote(client, workspace_id, existing, items, show_cost=_can_view_cost(ctx)) | {
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
    client.patch(
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
    items = _load_items(client, workspace_id, quote_id)
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
            "line_net": item.get("line_net") or 0,
        }
        created_or_403(client.post("quote_items", payload))
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
                "select": PACKAGE_SELECT,
                "order": "name.asc",
            },
        )
    )
    return {"items": rows}


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
        client.patch(
            "quotes",
            {
                "margin_override_reason": body.reason.strip(),
                "margin_override_by": actor,
                "margin_override_at": now,
            },
            params={"id": f"eq.{quote_id}", "workspace_id": f"eq.{workspace_id}"},
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

    def _snap(version: int) -> dict | None:
        rows = as_list(
            client.get(
                "quote_versions",
                params={
                    "quote_id": f"eq.{quote_id}",
                    "workspace_id": f"eq.{workspace_id}",
                    "version": f"eq.{version}",
                    "select": "version,snapshot",
                },
            )
        )
        return rows[0] if rows else None

    left = _snap(from_version)
    right = _snap(to_ver)
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
            if qty_a != qty_b or price_a != price_b or (la.get("description") != lb.get("description")):
                changes.append(
                    {
                        "key": key,
                        "change": "modified",
                        "from": {"qty": qty_a, "unit_price": price_a, "description": la.get("description")},
                        "to": {"qty": qty_b, "unit_price": price_b, "description": lb.get("description")},
                    }
                )
    pub_a = (left.get("snapshot") or {}).get("public") or {}
    pub_b = (right.get("snapshot") or {}).get("public") or {}
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
    inline: bool = False,
):
    """Binary PDF from the same canonical document payload as preview/customer view."""
    from ..pdf_response import pdf_response
    from ..quote_pdf import render_quote_pdf

    ctx = _ctx(client, user, workspace_id)
    row = _load_quote(client, workspace_id, quote_id)
    require(ctx, "quotes.view", resource=_ref(row))
    items = _load_items(client, workspace_id, quote_id)
    document = _document_payload(client, workspace_id, row, items)
    for banned in ("cost_total", "margin_amount", "margin_percent", "internal_notes", "cost"):
        document.pop(banned, None)
    pdf_bytes, filename = render_quote_pdf(document)
    _record_event(
        client,
        workspace_id,
        quote_id,
        "pdf_generated",
        actor_id(user),
        {"version": row.get("version") or 1, "filename": filename},
    )
    return pdf_response(pdf_bytes, filename, inline=inline)
