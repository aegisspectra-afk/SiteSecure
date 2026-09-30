"""R3 System Design atomic Apply — fingerprints, confirmation, commercial prep."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from decimal import Decimal
from typing import Any
from uuid import uuid4

from ..config import Settings, get_settings
from ..errors import ApiError
from ..pricing import line_net
from ..quote_snapshot import catalog_line_snapshot

CONFIRMATION_TTL_SEC = 15 * 60
CCTV_SECTION_NAME = "מערכת CCTV"

PRODUCT_SELECT = (
    "id,sku,name,description,unit,kind,list_price,vat_eligible,is_labor,is_active,"
    "manufacturer,model,attributes"
)
PRODUCT_SELECT_WITH_COST = (
    "id,sku,name,description,unit,kind,list_price,cost,vat_eligible,is_labor,is_active,"
    "manufacturer,model,attributes"
)


def format_qty(qty: float | int | str | Decimal | None) -> str:
    """Match SQL: round(qty, 6) then strip trailing zeros."""
    try:
        q = Decimal(str(qty if qty is not None else 0))
    except Exception:
        q = Decimal("0")
    q = q.quantize(Decimal("0.000001"))
    text = format(q.normalize(), "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text or "0"


def engineering_fingerprint(product_id: str | None, qty: float | int | str | None) -> str:
    return f"{(product_id or '').strip()}|{format_qty(qty)}"


def applied_fingerprint_from_component(comp: dict[str, Any]) -> str:
    stored = (comp.get("applied_output_fingerprint") or "").strip()
    if stored:
        return stored
    return engineering_fingerprint(comp.get("applied_product_id"), comp.get("applied_qty"))


def effective_product_id(comp: dict[str, Any]) -> str | None:
    if comp.get("removed"):
        return None
    origin = str(comp.get("selection_origin") or "UNSELECTED").upper()
    if origin == "UNSELECTED":
        return None
    pid = comp.get("user_selected_product_id") or comp.get("engine_preferred_product_id")
    if not pid:
        return None
    return str(pid)


def proposed_engineering_lines(components: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Build engineering-only proposed lines from Design components."""
    lines: list[dict[str, Any]] = []
    for comp in components:
        pid = effective_product_id(comp)
        if not pid:
            continue
        qty = float(comp.get("quantity") or 1)
        if qty <= 0:
            continue
        lines.append(
            {
                "component_id": str(comp["id"]),
                "role_key": str(comp.get("role_key") or ""),
                "product_id": pid,
                "qty": qty,
                "optional": bool(comp.get("optional")),
                "fingerprint": engineering_fingerprint(pid, qty),
            }
        )
    return lines


def proposed_hash(lines: list[dict[str, Any]]) -> str:
    parts = [
        f"{ln['component_id']}:{ln['product_id']}|{format_qty(ln['qty'])}"
        for ln in lines
    ]
    return "|".join(sorted(parts))


def detect_divergence(
    components: list[dict[str, Any]],
    quote_items_by_id: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    """Engineering divergence vs last applied fingerprints (price/discount ignored)."""
    diverged: list[dict[str, Any]] = []
    for comp in components:
        item_id = comp.get("quote_item_id")
        if not item_id:
            continue
        applied = {
            "product_id": str(comp.get("applied_product_id") or "") or None,
            "qty": float(comp["applied_qty"]) if comp.get("applied_qty") is not None else None,
            "fingerprint": applied_fingerprint_from_component(comp),
        }
        item = quote_items_by_id.get(str(item_id))
        if item is None:
            diverged.append(
                {
                    "component_id": str(comp["id"]),
                    "role_key": str(comp.get("role_key") or ""),
                    "kind": "MISSING",
                    "applied": applied,
                    "current": None,
                }
            )
            continue
        live_fp = engineering_fingerprint(item.get("product_id"), item.get("qty"))
        item_type = str(item.get("item_type") or "catalog")
        if live_fp != applied["fingerprint"] or item_type != "catalog":
            diverged.append(
                {
                    "component_id": str(comp["id"]),
                    "role_key": str(comp.get("role_key") or ""),
                    "kind": "CHANGED",
                    "applied": applied,
                    "current": {
                        "quote_item_id": str(item["id"]),
                        "product_id": str(item.get("product_id") or "") or None,
                        "qty": float(item.get("qty") or 0),
                        "fingerprint": live_fp,
                    },
                }
            )
    return diverged


def divergence_hash(diverged: list[dict[str, Any]]) -> str:
    parts: list[str] = []
    for d in diverged:
        applied_fp = (d.get("applied") or {}).get("fingerprint") or ""
        if d.get("kind") == "MISSING":
            parts.append(f"{d['component_id']}:MISSING:{applied_fp}")
        else:
            cur = d.get("current") or {}
            cur_fp = cur.get("fingerprint") or engineering_fingerprint(
                cur.get("product_id"), cur.get("qty")
            )
            parts.append(f"{d['component_id']}:CHANGED:{applied_fp}=>{cur_fp}")
    return "|".join(sorted(parts))


def _signing_key(settings: Settings | None = None) -> bytes:
    settings = settings or get_settings()
    raw = (settings.supabase_service_role_key or settings.supabase_anon_key or "").strip()
    if not raw:
        raw = "site-secure-dev-apply-confirm"
    return hashlib.sha256(raw.encode("utf-8")).digest()


def issue_confirmation_token(
    *,
    workspace_id: str,
    quote_id: str,
    design_id: str,
    revision: int,
    divergence_hash_value: str,
    proposed_hash_value: str,
    ttl_sec: int = CONFIRMATION_TTL_SEC,
    settings: Settings | None = None,
) -> tuple[str, str]:
    exp = int(time.time()) + ttl_sec
    payload = {
        "v": 1,
        "ws": str(workspace_id),
        "qid": str(quote_id),
        "did": str(design_id),
        "rev": int(revision),
        "div": divergence_hash_value,
        "prop": proposed_hash_value,
        "exp": exp,
    }
    body = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    sig = hmac.new(_signing_key(settings), body.encode("utf-8"), hashlib.sha256).hexdigest()
    token_obj = {**payload, "sig": sig}
    token = base64.urlsafe_b64encode(
        json.dumps(token_obj, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).decode("ascii")
    from datetime import UTC, datetime

    expires_at = datetime.fromtimestamp(exp, tz=UTC).isoformat().replace("+00:00", "Z")
    return token, expires_at


def verify_confirmation_token(
    token: str,
    *,
    workspace_id: str,
    quote_id: str,
    design_id: str,
    revision: int,
    divergence_hash_value: str,
    proposed_hash_value: str,
    settings: Settings | None = None,
) -> None:
    try:
        raw = base64.urlsafe_b64decode(token.encode("ascii"))
        data = json.loads(raw.decode("utf-8"))
    except Exception as exc:
        raise ApiError(409, "CONFIRMATION_STALE", "אישור ההחלפה אינו תקף — יש לסקור מחדש") from exc
    if not isinstance(data, dict):
        raise ApiError(409, "CONFIRMATION_STALE", "אישור ההחלפה אינו תקף — יש לסקור מחדש")
    sig = data.pop("sig", None)
    if not sig or not isinstance(sig, str):
        raise ApiError(409, "CONFIRMATION_STALE", "אישור ההחלפה אינו תקף — יש לסקור מחדש")
    body = json.dumps(data, sort_keys=True, separators=(",", ":"))
    expected = hmac.new(_signing_key(settings), body.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected):
        raise ApiError(409, "CONFIRMATION_STALE", "אישור ההחלפה אינו תקף — יש לסקור מחדש")
    now = int(time.time())
    if int(data.get("exp") or 0) < now:
        raise ApiError(409, "CONFIRMATION_STALE", "תוקף האישור פג — יש לסקור מחדש")
    if (
        str(data.get("ws")) != str(workspace_id)
        or str(data.get("qid")) != str(quote_id)
        or str(data.get("did")) != str(design_id)
        or int(data.get("rev") or -1) != int(revision)
        or str(data.get("div") or "") != divergence_hash_value
        or str(data.get("prop") or "") != proposed_hash_value
    ):
        raise ApiError(409, "CONFIRMATION_STALE", "מצב ההצעה השתנה — יש לסקור מחדש")


def commercial_preserve_fields(live_item: dict[str, Any] | None) -> dict[str, Any]:
    """
    Fields preserved when the same engineering line (product+qty) is replaced.

    Preserved: unit_price, discount, discount_type, description, section_id
    Cost is always re-resolved from catalog (not browser-injectable).
    """
    if not live_item:
        return {}
    return {
        "unit_price": float(live_item.get("unit_price") or 0),
        "discount": float(live_item.get("discount") or 0),
        "discount_type": str(live_item.get("discount_type") or "amount"),
        "description": str(live_item.get("description") or ""),
        "section_id": live_item.get("section_id"),
    }


def prepare_commercial_lines(
    *,
    products_by_id: dict[str, dict[str, Any]],
    proposed: list[dict[str, Any]],
    components_by_id: dict[str, dict[str, Any]],
    quote_items_by_id: dict[str, dict[str, Any]],
    default_section_id: str | None,
) -> list[dict[str, Any]]:
    """Server-authoritative commercial rows for RPC insert (no client money)."""
    rows: list[dict[str, Any]] = []
    for ln in proposed:
        product = products_by_id.get(ln["product_id"])
        if not product or product.get("is_active") is False:
            raise ApiError(404, "NOT_FOUND", "מוצר לא נמצא או אינו פעיל")
        comp = components_by_id.get(ln["component_id"]) or {}
        live = None
        owned_id = comp.get("quote_item_id")
        if owned_id:
            live = quote_items_by_id.get(str(owned_id))
        preserve = False
        if live is not None:
            live_fp = engineering_fingerprint(live.get("product_id"), live.get("qty"))
            if live_fp == ln["fingerprint"]:
                preserve = True
        preserved = commercial_preserve_fields(live) if preserve else {}

        unit_price = (
            float(preserved["unit_price"])
            if preserve
            else float(product.get("list_price") or 0)
        )
        discount = float(preserved["discount"]) if preserve else 0.0
        discount_type = str(preserved["discount_type"]) if preserve else "amount"
        description = (
            str(preserved["description"])
            if preserve and preserved.get("description")
            else (product.get("description") or product.get("name") or "")
        ).strip()
        section_id = (
            preserved.get("section_id")
            if preserve and preserved.get("section_id")
            else default_section_id
        )
        cost = float(product.get("cost") or 0)
        snapshot = catalog_line_snapshot(product)
        qty = float(ln["qty"])
        rows.append(
            {
                "component_id": ln["component_id"],
                "product_id": ln["product_id"],
                "qty": qty,
                "description": description,
                "unit_price": unit_price,
                "cost": cost,
                "discount": discount,
                "discount_type": discount_type,
                "line_net": float(
                    line_net(
                        qty=qty,
                        unit_price=unit_price,
                        discount=discount,
                        item_type="catalog",
                        discount_type=discount_type,
                    )
                ),
                "sku": product.get("sku"),
                "name": product.get("name"),
                "unit": product.get("unit"),
                "catalog_snapshot": snapshot,
                "section_id": str(section_id) if section_id else None,
            }
        )
    return rows


def new_apply_id() -> str:
    return str(uuid4())


def map_rpc_error(message: str) -> ApiError:
    text = (message or "").upper()
    if "REVISION_CONFLICT" in text:
        return ApiError(409, "CONFLICT_REVISION", "העיצוב עודכן במקביל — רענון נדרש")
    if "DIVERGED" in text:
        return ApiError(409, "DESIGN_APPLY_DIVERGED", "פלט ההצעה השתנה מאז ההחלה האחרונה")
    if "CONFIRMATION_STALE" in text:
        return ApiError(409, "CONFIRMATION_STALE", "מצב ההצעה השתנה — יש לסקור מחדש")
    if "QUOTE_NOT_DRAFT" in text:
        return ApiError(403, "RESOURCE_STATE", "לא ניתן להחיל על הצעה שאינה טיוטה")
    if "PERMISSION_DENIED" in text or "UNAUTHENTICATED" in text:
        return ApiError(403, "PERMISSION_DENIED", "אין הרשאה")
    if "DESIGN_QUOTE_MISMATCH" in text or "DESIGN_NOT_FOUND" in text:
        return ApiError(404, "NOT_FOUND", "עיצוב לא נמצא")
    if "QUOTE_NOT_FOUND" in text:
        return ApiError(404, "NOT_FOUND", "הצעה לא נמצאה")
    if "INVALID_PRODUCT" in text or "INVALID_COMPONENT" in text or "INVALID_LINES" in text:
        return ApiError(400, "VALIDATION_ERROR", "נתוני החלה לא תקינים")
    if "INVALID_SECTION" in text:
        return ApiError(400, "VALIDATION_ERROR", "סקשן לא תקין")
    return ApiError(409, "DESIGN_APPLY_FAILED", "החלת העיצוב נכשלה", {"detail": message[:400]})


def ensure_cctv_section_id(
    *,
    existing_sections: list[dict[str, Any]],
    create_section,
    preferred_name: str = CCTV_SECTION_NAME,
) -> str:
    """Reuse an existing CCTV section by name, or create one via caller-supplied create."""
    target = preferred_name.strip()
    for sec in existing_sections:
        if str(sec.get("name") or "").strip() == target:
            return str(sec["id"])
    for sec in existing_sections:
        name = str(sec.get("name") or "").strip()
        if name == target or name.startswith(f"{target} ("):
            return str(sec["id"])
    return create_section(target)
