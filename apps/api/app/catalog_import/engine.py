"""Build preview rows and commit payloads from an import session + mappings."""

from __future__ import annotations

from typing import Any

from ..catalog_attrs import normalize_unit, validate_product_attributes, AttributeValidationError
from .normalize import normalize_mapped_value

DuplicatePolicy = str  # skip | update | new_only


def _is_product_row(row: list[Any], sku_idx: int | None) -> bool:
    if not row or not any(v is not None and str(v).strip() != "" for v in row):
        return False
    if sku_idx is not None:
        if sku_idx >= len(row) or row[sku_idx] is None or str(row[sku_idx]).strip() == "":
            return False
        return True
    # Without SKU map: require at least 2 non-empty cells and a string-ish first populated cell
    nonempty = [v for v in row if v is not None and str(v).strip() != ""]
    return len(nonempty) >= 2


def _sku_col(column_map: dict[str, str]) -> int | None:
    for k, v in column_map.items():
        if v == "sku":
            try:
                return int(k)
            except ValueError:
                return None
    return None


def build_row_product(
    row: list[Any],
    *,
    column_map: dict[str, str],
    manufacturer_default: str | None,
    unit_default: str,
    category_id: str | None,
    category_key: str | None,
    parent_key: str | None,
    can_set_cost: bool,
) -> dict[str, Any]:
    """Transform one source row into a candidate product + status."""
    commercial: dict[str, Any] = {
        "sku": None,
        "name": None,
        "description": None,
        "manufacturer": (manufacturer_default or "").strip() or None,
        "model": None,
        "unit": unit_default or "unit",
        "cost": None,
        "list_price": None,
        "kind": "product",
    }
    attributes: dict[str, Any] = {}
    provenance: dict[str, str] = {}
    warnings: list[str] = []
    original_snap: dict[str, Any] = {}

    for idx_s, field in column_map.items():
        try:
            idx = int(idx_s)
        except ValueError:
            continue
        raw = row[idx] if idx < len(row) else None
        if raw is not None and str(raw).strip() != "":
            original_snap[field] = raw
        norm = normalize_mapped_value(field, raw)
        if norm.get("warning"):
            warnings.append(str(norm["warning"]))
        provenance[field] = str(norm.get("provenance") or "UNKNOWN")
        val = norm.get("value")
        if val is None:
            continue
        if field.startswith("attributes."):
            attributes[field.removeprefix("attributes.")] = val
        elif field in commercial:
            if field == "cost" and not can_set_cost:
                warnings.append("cost_permission_denied")
                continue
            commercial[field] = val
        elif field == "category":
            # Category from column ignored in V1 — sheet-level category_id wins
            warnings.append("category_column_ignored")

    if not commercial.get("name"):
        if commercial.get("model"):
            commercial["name"] = str(commercial["model"])
        elif commercial.get("sku"):
            commercial["name"] = str(commercial["sku"])

    if commercial.get("unit"):
        commercial["unit"] = normalize_unit(str(commercial["unit"]))

    # Defaults
    if commercial.get("list_price") is None:
        commercial["list_price"] = 0.0
        warnings.append("list_price_unset")
    if commercial.get("cost") is None:
        commercial["cost"] = 0.0

    status = "ready"
    block_reasons: list[str] = []
    if not commercial.get("sku"):
        block_reasons.append("missing_sku")
    if not commercial.get("name"):
        block_reasons.append("missing_name")
    if not category_id:
        block_reasons.append("missing_category")

    # Validate attributes against schema — drop invalid keys rather than block when possible
    try:
        attributes = validate_product_attributes(
            attributes,
            category_key=category_key,
            parent_key=parent_key,
        )
    except AttributeValidationError as exc:
        # Keep only keys that validate individually
        cleaned: dict[str, Any] = {}
        for k, v in list(attributes.items()):
            try:
                part = validate_product_attributes(
                    {k: v},
                    category_key=category_key,
                    parent_key=parent_key,
                )
                cleaned.update(part)
            except AttributeValidationError:
                warnings.append(f"attr_dropped:{k}")
        attributes = cleaned
        warnings.append("attribute_validation_partial")
        if exc.field_errors:
            warnings.append("attribute_warnings")

    if block_reasons:
        status = "blocked"
    elif warnings:
        status = "warning"

    return {
        "status": status,
        "block_reasons": block_reasons,
        "warnings": warnings,
        "provenance": provenance,
        "original": original_snap,
        "product": {
            "sku": str(commercial["sku"]) if commercial.get("sku") is not None else None,
            "name": commercial.get("name"),
            "description": commercial.get("description") or "",
            "manufacturer": commercial.get("manufacturer"),
            "model": commercial.get("model"),
            "unit": commercial.get("unit") or "unit",
            "kind": "product",
            "list_price": float(commercial.get("list_price") or 0),
            "cost": float(commercial.get("cost") or 0),
            "category_id": category_id,
            "is_active": True,
            "attributes": attributes,
            "vat_eligible": True,
        },
    }


def collect_candidates(
    session_sheets: list[dict[str, Any]],
    sheet_configs: list[dict[str, Any]],
    *,
    categories_by_id: dict[str, dict],
    can_set_cost: bool,
) -> list[dict[str, Any]]:
    by_index = {int(s["index"]): s for s in session_sheets}
    out: list[dict[str, Any]] = []
    for cfg in sheet_configs:
        if not cfg.get("include", True):
            continue
        idx = int(cfg["sheet_index"])
        src = by_index.get(idx)
        if not src:
            continue
        header_row = int(cfg.get("header_row") or src.get("header_row") or 1)
        column_map = {str(k): str(v) for k, v in (cfg.get("column_map") or {}).items() if v}
        category_id = cfg.get("category_id")
        cat = categories_by_id.get(str(category_id)) if category_id else None
        parent = categories_by_id.get(str(cat.get("parent_id"))) if cat and cat.get("parent_id") else None
        category_key = cat.get("key") if cat else None
        parent_key = parent.get("key") if parent else None
        sku_idx = _sku_col(column_map)
        rows: list[list[Any]] = src.get("rows") or []
        for ri, row in enumerate(rows, start=1):
            if ri <= header_row:
                continue
            if not _is_product_row(row, sku_idx):
                continue
            built = build_row_product(
                row,
                column_map=column_map,
                manufacturer_default=cfg.get("manufacturer_default"),
                unit_default=cfg.get("unit_default") or "unit",
                category_id=str(category_id) if category_id else None,
                category_key=category_key,
                parent_key=parent_key,
                can_set_cost=can_set_cost,
            )
            built["sheet_index"] = idx
            built["sheet_name"] = src.get("name")
            built["source_row"] = ri
            out.append(built)
    return out


def classify_duplicates(
    candidates: list[dict[str, Any]],
    existing_skus: dict[str, str],
    policy: DuplicatePolicy,
) -> None:
    """Mutate candidates with duplicate_action: create|update|skip|blocked_dup."""
    for c in candidates:
        if c["status"] == "blocked":
            c["duplicate_action"] = "none"
            continue
        sku = (c.get("product") or {}).get("sku")
        if not sku:
            c["duplicate_action"] = "none"
            continue
        if sku in existing_skus:
            c["existing_id"] = existing_skus[sku]
            c["is_duplicate"] = True
            if policy == "skip":
                c["duplicate_action"] = "skip"
            elif policy == "update":
                c["duplicate_action"] = "update"
            elif policy == "new_only":
                c["duplicate_action"] = "skip"
            else:
                c["duplicate_action"] = "skip"
        else:
            c["is_duplicate"] = False
            c["duplicate_action"] = "create"


def summarize_candidates(candidates: list[dict[str, Any]]) -> dict[str, Any]:
    ready = sum(1 for c in candidates if c["status"] == "ready")
    warning = sum(1 for c in candidates if c["status"] == "warning")
    blocked = sum(1 for c in candidates if c["status"] == "blocked")
    duplicates = sum(1 for c in candidates if c.get("is_duplicate"))
    will_create = sum(1 for c in candidates if c.get("duplicate_action") == "create" and c["status"] != "blocked")
    will_update = sum(1 for c in candidates if c.get("duplicate_action") == "update" and c["status"] != "blocked")
    will_skip = sum(1 for c in candidates if c.get("duplicate_action") == "skip")
    return {
        "detected": len(candidates),
        "ready": ready,
        "warning": warning,
        "blocked": blocked,
        "duplicates": duplicates,
        "will_create": will_create,
        "will_update": will_update,
        "will_skip": will_skip,
    }


def readiness_from_products(products: list[dict[str, Any]], categories_by_id: dict[str, dict]) -> dict[str, Any]:
    """Mirror resolver core requirements (not vanity %)."""
    cam = nvr = hdd = sw = 0
    incomplete = 0
    for p in products:
        cat = categories_by_id.get(str(p.get("category_id"))) if p.get("category_id") else None
        key = (cat or {}).get("key") or ""
        attrs = p.get("attributes") if isinstance(p.get("attributes"), dict) else {}
        if key.startswith("cameras_"):
            if attrs.get("resolution_mp") is not None:
                cam += 1
            else:
                incomplete += 1
        elif key in {"nvr", "dvr_xvr"}:
            if attrs.get("channels") is not None:
                nvr += 1
            else:
                incomplete += 1
        elif key == "hdd_recorders":
            if attrs.get("capacity_tb") is not None:
                hdd += 1
            else:
                incomplete += 1
        elif key.startswith("switch") or key.startswith("poe"):
            if attrs.get("poe_ports") is not None or attrs.get("ports") is not None:
                sw += 1
            else:
                incomplete += 1
    return {
        "camera_structured": cam,
        "nvr_structured": nvr,
        "hdd_structured": hdd,
        "switch_structured": sw,
        "ready_for_core": cam > 0 and nvr > 0 and hdd > 0,
        "incomplete_technical": incomplete,
        "missing_families": [
            name
            for name, count in (
                ("camera", cam),
                ("recorder", nvr),
                ("storage", hdd),
                ("poe_switch", sw),
            )
            if count == 0
        ],
    }
