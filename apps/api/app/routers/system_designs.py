"""Durable System Design — persistence CRUD + R3 atomic owned Apply."""

from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field

from ..authz.guard import require
from ..authz.types import ResourceRef
from ..deps import UserClient, current_user, load_authz_context, user_client
from ..errors import MESSAGES, ApiError
from ..identity import actor_id
from ..rest import as_list, created_or_403, one_or_404, patched_or_403
from ..system_designs import (
    ENGINE_TYPES,
    LIFECYCLE_STATUSES,
    SELECTION_ORIGINS,
    sanitize_candidates,
    sanitize_json_object,
    sanitize_reason_codes,
    strip_commercial_keys,
)
from ..system_designs.apply import (
    CCTV_SECTION_NAME,
    PRODUCT_SELECT_WITH_COST,
    detect_divergence,
    divergence_hash,
    ensure_cctv_section_id,
    issue_confirmation_token,
    map_rpc_error,
    new_apply_id,
    prepare_commercial_lines,
    proposed_engineering_lines,
    proposed_hash,
    verify_confirmation_token,
)

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}", tags=["system-designs"])

DESIGN_SELECT = (
    "id,workspace_id,quote_id,site_id,engine_type,engine_version,lifecycle_status,"
    "requirements,engineering_result,recommendation_meta,calculated_at,last_applied_at,"
    "current_apply_id,apply_fingerprint,revision,created_by,created_at,updated_at,deleted_at"
)
COMPONENT_SELECT = (
    "id,workspace_id,design_id,role_key,label,quantity,optional,blocking,removed,"
    "resolution_status,technical_requirements,candidates,engine_preferred_product_id,"
    "user_selected_product_id,selection_origin,reason_codes,needs_review,quote_item_id,"
    "applied_product_id,applied_qty,applied_output_fingerprint,last_apply_id,"
    "created_at,updated_at"
)
QUOTE_PARENT_SELECT = "id,workspace_id,site_id,owner_user_id,status,deleted_at"


class SystemDesignCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    engine_type: str = "cctv"
    engine_version: int = Field(default=1, ge=1)
    requirements: dict[str, Any] = Field(default_factory=dict)
    site_id: str | None = None


class SystemDesignComponentIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str | None = None
    role_key: str = Field(min_length=1, max_length=120)
    label: str = ""
    quantity: float = Field(default=1, ge=0)
    optional: bool = False
    blocking: bool = False
    removed: bool = False
    resolution_status: str | None = None
    technical_requirements: dict[str, Any] = Field(default_factory=dict)
    candidates: list[Any] = Field(default_factory=list)
    engine_preferred_product_id: str | None = None
    user_selected_product_id: str | None = None
    selection_origin: str = "UNSELECTED"
    reason_codes: list[Any] = Field(default_factory=list)
    needs_review: bool = False
    # Linkage / apply fields accepted for round-trip storage before Apply exists;
    # R1 does not set them via Apply.
    quote_item_id: str | None = None
    applied_product_id: str | None = None
    applied_qty: float | None = Field(default=None, ge=0)
    applied_output_fingerprint: str | None = None
    last_apply_id: str | None = None


class SystemDesignPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: int = Field(ge=1)
    requirements: dict[str, Any] | None = None
    engineering_result: dict[str, Any] | None = None
    recommendation_meta: dict[str, Any] | None = None
    lifecycle_status: str | None = None
    engine_version: int | None = Field(default=None, ge=1)
    calculated_at: str | None = None
    site_id: str | None = None
    components: list[SystemDesignComponentIn] | None = None
    components_replace: bool = False


class SystemDesignApplyIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: int = Field(ge=1)
    confirmation_token: str | None = None
    section_name: str | None = None


def _ctx(client: UserClient, user: dict, workspace_id: UUID):
    return load_authz_context(client, actor_id(user), str(workspace_id))


def _quote_ref(quote: dict) -> ResourceRef:
    return ResourceRef(
        type="quote",
        id=str(quote["id"]),
        owner_user_id=quote.get("owner_user_id"),
        site_id=quote.get("site_id"),
        state=quote.get("status"),
    )


def _load_live_quote(client: UserClient, workspace_id: UUID, quote_id: UUID) -> dict:
    row = one_or_404(
        client.get(
            "quotes",
            params={
                "id": f"eq.{quote_id}",
                "workspace_id": f"eq.{workspace_id}",
                "deleted_at": "is.null",
                "select": QUOTE_PARENT_SELECT,
            },
        )
    )
    if row.get("deleted_at"):
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    return row


def _public_component(row: dict) -> dict:
    out = {k: row.get(k) for k in COMPONENT_SELECT.split(",")}
    out["candidates"] = strip_commercial_keys(out.get("candidates") or [])
    out["technical_requirements"] = strip_commercial_keys(out.get("technical_requirements") or {})
    out["reason_codes"] = strip_commercial_keys(out.get("reason_codes") or [])
    for key in ("cost", "list_price", "unit_price", "subtotal_net", "vat_amount", "total_gross", "margin"):
        out.pop(key, None)
    return out


def _public_design(row: dict, components: list[dict]) -> dict:
    out = {k: row.get(k) for k in DESIGN_SELECT.split(",") if k != "deleted_at"}
    out["requirements"] = strip_commercial_keys(out.get("requirements") or {})
    if out.get("engineering_result") is not None:
        out["engineering_result"] = strip_commercial_keys(out.get("engineering_result"))
    if out.get("recommendation_meta") is not None:
        out["recommendation_meta"] = strip_commercial_keys(out.get("recommendation_meta"))
    for key in (
        "subtotal_net",
        "vat_amount",
        "total_gross",
        "cost_total",
        "margin_amount",
        "margin_percent",
        "cost",
        "list_price",
    ):
        out.pop(key, None)
    out["components"] = [_public_component(c) for c in components]
    return out


def _load_components(client: UserClient, workspace_id: UUID, design_id: str) -> list[dict]:
    return as_list(
        client.get(
            "system_design_components",
            params={
                "design_id": f"eq.{design_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": COMPONENT_SELECT,
                "order": "role_key.asc",
            },
        )
    )


def _load_design_row(client: UserClient, workspace_id: UUID, design_id: UUID) -> dict:
    row = one_or_404(
        client.get(
            "system_designs",
            params={
                "id": f"eq.{design_id}",
                "workspace_id": f"eq.{workspace_id}",
                "deleted_at": "is.null",
                "select": DESIGN_SELECT,
            },
        )
    )
    _load_live_quote(client, workspace_id, UUID(str(row["quote_id"])))
    return row


def _component_payload(
    *,
    workspace_id: str,
    design_id: str,
    body: SystemDesignComponentIn,
) -> dict[str, Any]:
    origin = (body.selection_origin or "UNSELECTED").strip().upper()
    if origin not in SELECTION_ORIGINS:
        raise ApiError(400, "VALIDATION_ERROR", "selection_origin לא תקין")
    try:
        candidates = sanitize_candidates(body.candidates)
        tech = sanitize_json_object(body.technical_requirements, field="technical_requirements")
        reasons = sanitize_reason_codes(body.reason_codes)
    except ValueError as exc:
        raise ApiError(400, "VALIDATION_ERROR", str(exc)) from exc
    return {
        "workspace_id": workspace_id,
        "design_id": design_id,
        "role_key": body.role_key.strip(),
        "label": body.label or "",
        "quantity": body.quantity,
        "optional": body.optional,
        "blocking": body.blocking,
        "removed": body.removed,
        "resolution_status": body.resolution_status,
        "technical_requirements": tech,
        "candidates": candidates,
        "engine_preferred_product_id": body.engine_preferred_product_id,
        "user_selected_product_id": body.user_selected_product_id,
        "selection_origin": origin,
        "reason_codes": reasons,
        "needs_review": body.needs_review,
        "quote_item_id": body.quote_item_id,
        "applied_product_id": body.applied_product_id,
        "applied_qty": body.applied_qty,
        "applied_output_fingerprint": body.applied_output_fingerprint,
        "last_apply_id": body.last_apply_id,
    }


def _upsert_components(
    client: UserClient,
    *,
    workspace_id: str,
    design_id: str,
    components: list[SystemDesignComponentIn],
    replace: bool,
) -> None:
    existing = _load_components(client, UUID(workspace_id), design_id)
    by_role = {str(c.get("role_key")): c for c in existing}
    by_id = {str(c.get("id")): c for c in existing}
    seen_roles: set[str] = set()

    for body in components:
        role = body.role_key.strip()
        if role in seen_roles:
            raise ApiError(400, "VALIDATION_ERROR", f"role_key כפול: {role}")
        seen_roles.add(role)
        payload = _component_payload(workspace_id=workspace_id, design_id=design_id, body=body)
        target = None
        if body.id and str(body.id) in by_id:
            target = by_id[str(body.id)]
        elif role in by_role:
            target = by_role[role]
        if target:
            patched_or_403(
                client.patch(
                    "system_design_components",
                    {k: v for k, v in payload.items() if k not in {"workspace_id", "design_id"}},
                    params={
                        "id": f"eq.{target['id']}",
                        "workspace_id": f"eq.{workspace_id}",
                        "design_id": f"eq.{design_id}",
                    },
                )
            )
        else:
            created_or_403(client.post("system_design_components", payload))

    if replace:
        for row in existing:
            if str(row.get("role_key")) not in seen_roles:
                client.delete(
                    "system_design_components",
                    params={
                        "id": f"eq.{row['id']}",
                        "workspace_id": f"eq.{workspace_id}",
                        "design_id": f"eq.{design_id}",
                    },
                )


@router.get("/quotes/{quote_id}/system-designs")
def list_system_designs(
    workspace_id: UUID,
    quote_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    quote = _load_live_quote(client, workspace_id, quote_id)
    require(ctx, "quotes.view", resource=_quote_ref(quote))
    rows = as_list(
        client.get(
            "system_designs",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "quote_id": f"eq.{quote_id}",
                "deleted_at": "is.null",
                "select": DESIGN_SELECT,
                "order": "created_at.asc",
            },
        )
    )
    items = []
    for row in rows:
        comps = _load_components(client, workspace_id, str(row["id"]))
        items.append(_public_design(row, comps))
    return {"items": items}


@router.post("/quotes/{quote_id}/system-designs")
def create_system_design(
    workspace_id: UUID,
    quote_id: UUID,
    body: SystemDesignCreate,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    quote = _load_live_quote(client, workspace_id, quote_id)
    require(ctx, "quotes.edit", resource=_quote_ref(quote))
    engine = (body.engine_type or "").strip().lower()
    if engine not in ENGINE_TYPES:
        raise ApiError(400, "VALIDATION_ERROR", "engine_type לא נתמך")
    try:
        requirements = sanitize_json_object(body.requirements, field="requirements")
    except ValueError as exc:
        raise ApiError(400, "VALIDATION_ERROR", str(exc)) from exc
    site_id = body.site_id
    if site_id is not None:
        quote_site = quote.get("site_id")
        if quote_site and str(quote_site) != str(site_id):
            raise ApiError(400, "VALIDATION_ERROR", "site_id חייב להתאים להצעה")
        if not quote_site:
            site_id = None
    else:
        site_id = quote.get("site_id")
    payload = {
        "workspace_id": str(workspace_id),
        "quote_id": str(quote_id),
        "site_id": site_id,
        "engine_type": engine,
        "engine_version": body.engine_version,
        "lifecycle_status": "draft",
        "requirements": requirements,
        "revision": 1,
        "created_by": actor_id(user),
    }
    row = created_or_403(client.post("system_designs", payload))
    return _public_design(row, [])


@router.get("/system-designs/{design_id}")
def get_system_design(
    workspace_id: UUID,
    design_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    row = _load_design_row(client, workspace_id, design_id)
    quote = _load_live_quote(client, workspace_id, UUID(str(row["quote_id"])))
    require(ctx, "quotes.view", resource=_quote_ref(quote))
    comps = _load_components(client, workspace_id, str(row["id"]))
    return _public_design(row, comps)


@router.patch("/system-designs/{design_id}")
def patch_system_design(
    workspace_id: UUID,
    design_id: UUID,
    body: SystemDesignPatch,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    existing = _load_design_row(client, workspace_id, design_id)
    quote = _load_live_quote(client, workspace_id, UUID(str(existing["quote_id"])))
    require(ctx, "quotes.edit", resource=_quote_ref(quote))

    expected = int(existing.get("revision") or 1)
    if int(body.revision) != expected:
        raise ApiError(
            409,
            "CONFLICT_REVISION",
            "העיצוב עודכן במקביל — רענון נדרש",
            {"expected_revision": expected, "provided_revision": body.revision},
        )

    patch: dict[str, Any] = {"revision": expected + 1}
    if body.requirements is not None:
        try:
            patch["requirements"] = sanitize_json_object(body.requirements, field="requirements")
        except ValueError as exc:
            raise ApiError(400, "VALIDATION_ERROR", str(exc)) from exc
    if body.engineering_result is not None:
        try:
            patch["engineering_result"] = sanitize_json_object(
                body.engineering_result, field="engineering_result"
            )
        except ValueError as exc:
            raise ApiError(400, "VALIDATION_ERROR", str(exc)) from exc
    if body.recommendation_meta is not None:
        try:
            patch["recommendation_meta"] = sanitize_json_object(
                body.recommendation_meta, field="recommendation_meta"
            )
        except ValueError as exc:
            raise ApiError(400, "VALIDATION_ERROR", str(exc)) from exc
    if body.lifecycle_status is not None:
        status = body.lifecycle_status.strip().lower()
        if status not in LIFECYCLE_STATUSES:
            raise ApiError(400, "VALIDATION_ERROR", "lifecycle_status לא תקין")
        patch["lifecycle_status"] = status
    if body.engine_version is not None:
        patch["engine_version"] = body.engine_version
    if body.calculated_at is not None:
        patch["calculated_at"] = body.calculated_at or None
    if body.site_id is not None:
        quote_site = quote.get("site_id")
        if body.site_id and quote_site and str(quote_site) != str(body.site_id):
            raise ApiError(400, "VALIDATION_ERROR", "site_id חייב להתאים להצעה")
        patch["site_id"] = body.site_id if quote_site else None

    res = client.patch(
        "system_designs",
        patch,
        params={
            "id": f"eq.{design_id}",
            "workspace_id": f"eq.{workspace_id}",
            "revision": f"eq.{expected}",
            "deleted_at": "is.null",
        },
    )
    if res.status_code != 200:
        patched_or_403(res)
    data = res.json()
    rows = data if isinstance(data, list) else ([data] if isinstance(data, dict) and data else [])
    if not rows:
        raise ApiError(
            409,
            "CONFLICT_REVISION",
            "העיצוב עודכן במקביל — רענון נדרש",
            {"expected_revision": expected, "provided_revision": body.revision},
        )
    row = rows[0]

    if body.components is not None:
        _upsert_components(
            client,
            workspace_id=str(workspace_id),
            design_id=str(design_id),
            components=body.components,
            replace=body.components_replace,
        )

    comps = _load_components(client, workspace_id, str(design_id))
    return _public_design(row, comps)


@router.delete("/system-designs/{design_id}")
def delete_system_design(
    workspace_id: UUID,
    design_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    """Hard-delete Design + components. Does NOT delete Quote lines."""
    ctx = _ctx(client, user, workspace_id)
    existing = _load_design_row(client, workspace_id, design_id)
    quote = _load_live_quote(client, workspace_id, UUID(str(existing["quote_id"])))
    require(ctx, "quotes.edit", resource=_quote_ref(quote))
    client.delete(
        "system_design_components",
        params={"design_id": f"eq.{design_id}", "workspace_id": f"eq.{workspace_id}"},
    )
    client.delete(
        "system_designs",
        params={
            "id": f"eq.{design_id}",
            "workspace_id": f"eq.{workspace_id}",
        },
    )
    return {"ok": True}


@router.post("/system-designs/{design_id}/apply")
def apply_system_design(
    workspace_id: UUID,
    design_id: UUID,
    body: SystemDesignApplyIn,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    """Atomic owned Apply / clean Re-Apply / confirmed replace. Pricing stays in Python."""
    from ..routers import quotes as quotes_mod

    ctx = _ctx(client, user, workspace_id)
    design = _load_design_row(client, workspace_id, design_id)
    quote_id = UUID(str(design["quote_id"]))
    quote = quotes_mod._load_quote(client, workspace_id, quote_id)
    require(ctx, "quotes.edit", resource=quotes_mod._ref(quote))

    if str(quote.get("status") or "") != "draft":
        raise ApiError(403, "RESOURCE_STATE", MESSAGES["RESOURCE_STATE"], {"state": quote.get("status")})

    expected = int(design.get("revision") or 1)
    if int(body.revision) != expected:
        raise ApiError(
            409,
            "CONFLICT_REVISION",
            "העיצוב עודכן במקביל — רענון נדרש",
            {"expected_revision": expected, "provided_revision": body.revision},
        )

    components = _load_components(client, workspace_id, str(design_id))
    proposed = proposed_engineering_lines(components)
    if not proposed:
        raise ApiError(400, "VALIDATION_ERROR", "אין רכיבים נבחרים להחלה")

    prop_hash = proposed_hash(proposed)
    items = quotes_mod._load_items(client, workspace_id, quote_id)
    items_by_id = {str(i["id"]): i for i in items}
    diverged = detect_divergence(components, items_by_id)
    div_hash = divergence_hash(diverged)

    if diverged and not body.confirmation_token:
        token, expires_at = issue_confirmation_token(
            workspace_id=str(workspace_id),
            quote_id=str(quote_id),
            design_id=str(design_id),
            revision=expected,
            divergence_hash_value=div_hash,
            proposed_hash_value=prop_hash,
        )
        manual_count = sum(
            1
            for i in items
            if str(i["id"]) not in {str(c.get("quote_item_id")) for c in components if c.get("quote_item_id")}
        )
        raise ApiError(
            409,
            "DESIGN_APPLY_DIVERGED",
            "פלט ההצעה השתנה מאז ההחלה האחרונה — נדרש אישור החלפה",
            {
                "design_id": str(design_id),
                "revision": expected,
                "confirmation_required": True,
                "confirmation_token": token,
                "confirmation_expires_at": expires_at,
                "diverged": diverged,
                "proposed": [
                    {
                        "component_id": p["component_id"],
                        "role_key": p["role_key"],
                        "product_id": p["product_id"],
                        "qty": p["qty"],
                        "optional": p["optional"],
                    }
                    for p in proposed
                ],
                "untouched_manual_item_count": manual_count,
            },
        )

    if body.confirmation_token:
        verify_confirmation_token(
            body.confirmation_token,
            workspace_id=str(workspace_id),
            quote_id=str(quote_id),
            design_id=str(design_id),
            revision=expected,
            divergence_hash_value=div_hash,
            proposed_hash_value=prop_hash,
        )

    # Resolve catalog products server-side (money authority). cost via service_role (Q4-S).
    product_ids = sorted({p["product_id"] for p in proposed})
    products = as_list(
        quotes_mod._service().get(
            "products",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "id": f"in.({','.join(product_ids)})",
                "select": PRODUCT_SELECT_WITH_COST,
            },
        )
    )
    products_by_id = {str(p["id"]): p for p in products}

    sections = quotes_mod._load_sections(client, workspace_id, quote_id)
    section_name = (body.section_name or CCTV_SECTION_NAME).strip() or CCTV_SECTION_NAME

    def _create_section(name: str) -> str:
        sort_base = max((int(s.get("sort_order") or 0) for s in sections), default=0)
        row = created_or_403(
            client.post(
                "quote_sections",
                {
                    "workspace_id": str(workspace_id),
                    "quote_id": str(quote_id),
                    "name": name,
                    "sort_order": sort_base + 10,
                    "discount_type": "amount",
                    "discount_value": 0,
                    "collapsed": False,
                },
            )
        )
        sections.append(row)
        return str(row["id"])

    section_id = ensure_cctv_section_id(
        existing_sections=sections,
        create_section=_create_section,
        preferred_name=section_name,
    )

    components_by_id = {str(c["id"]): c for c in components}
    prepared = prepare_commercial_lines(
        products_by_id=products_by_id,
        proposed=proposed,
        components_by_id=components_by_id,
        quote_items_by_id=items_by_id,
        default_section_id=section_id,
    )

    apply_id = new_apply_id()
    actor = actor_id(user)
    res = client.rpc(
        "system_design_apply_owned",
        {
            "p_workspace_id": str(workspace_id),
            "p_quote_id": str(quote_id),
            "p_design_id": str(design_id),
            "p_expected_revision": expected,
            "p_actor_id": actor,
            "p_apply_id": apply_id,
            "p_section_id": section_id,
            "p_lines": prepared,
            "p_confirmed": bool(body.confirmation_token),
            "p_expected_divergence_hash": div_hash if diverged else None,
            "p_expected_proposed_hash": prop_hash,
        },
    )
    if res.status_code not in {200, 201}:
        detail = ""
        try:
            payload = res.json()
            detail = str(payload.get("message") or payload.get("hint") or payload)[:500]
        except Exception:
            detail = (res.text or "")[:500]
        raise map_rpc_error(detail)

    rpc_result = res.json() if res.content else {}
    if not isinstance(rpc_result, dict):
        rpc_result = {}

    # Reload quote + design after composition mutation
    quote = quotes_mod._load_quote(client, workspace_id, quote_id)
    items = quotes_mod._load_items(client, workspace_id, quote_id)
    design_row = _load_design_row(client, workspace_id, design_id)
    comps = _load_components(client, workspace_id, str(design_id))

    pricing_error: dict[str, Any] | None = None
    try:
        quote, items = quotes_mod._persist_totals(client, workspace_id, quote, items)
    except Exception as exc:
        # RPC already committed — surface recoverable stale-total window.
        pricing_error = {
            "code": "PRICING_PERSIST_FAILED",
            "message": "ההרכב הוחל אך עדכון הסיכומים נכשל — ניתן לחשב מחדש",
            "detail": str(exc)[:300],
        }

    quote_out = quotes_mod._with_validation(
        client, workspace_id, quote, items, show_cost=quotes_mod._can_view_cost(ctx)
    )
    out: dict[str, Any] = {
        "ok": pricing_error is None,
        "apply_id": rpc_result.get("apply_id") or apply_id,
        "design": _public_design(design_row, comps),
        "quote": quote_out,
    }
    if pricing_error:
        out["pricing_error"] = pricing_error
        raise ApiError(
            503,
            "API_UNAVAILABLE",
            pricing_error["message"],
            {
                "apply_committed": True,
                "apply_id": out["apply_id"],
                "design_id": str(design_id),
                "quote_id": str(quote_id),
                "revision": design_row.get("revision"),
                "recalculate_path": f"/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/recalculate",
            },
        )
    return out
