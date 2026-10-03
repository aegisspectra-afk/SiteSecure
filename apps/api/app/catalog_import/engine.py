"""Build preview rows and commit payloads from an import session + mappings."""

from __future__ import annotations

import re
from typing import Any

from ..catalog_attrs import normalize_unit, validate_product_attributes, AttributeValidationError
from .normalize import normalize_mapped_value

DuplicatePolicy = str  # skip | update | new_only
InFileDuplicateMode = str  # block | suffix

# Model/SKU-like tokens (e.g. IPC642E-X22I-IN, NVR301-08E-IQ, PWR-DC12-350A-IN).
_SKU_LIKE = re.compile(
    r"^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9][A-Za-z0-9._/\-]{2,62}[A-Za-z0-9]$"
)
_SKU_PREFIX = re.compile(r"^(IPC|NVR|DVR|XVR|PWR|DS-|DH-|UNV)", re.I)


def looks_like_sku(value: str | None) -> bool:
    s = (value or "").strip()
    if len(s) < 4 or len(s) > 64:
        return False
    # Hebrew prose is never a SKU; mixed HE+code still rejected here.
    if re.search(r"[\u0590-\u05FF]", s):
        return False
    if " " in s:
        return False
    if _SKU_LIKE.fullmatch(s):
        return True
    return bool(_SKU_PREFIX.match(s)) and any(ch.isdigit() for ch in s)


def _field_col(column_map: dict[str, str], field: str) -> int | None:
    for k, v in column_map.items():
        if v == field:
            try:
                return int(k)
            except ValueError:
                return None
    return None


def _cell(row: list[Any], idx: int | None) -> str:
    if idx is None or idx < 0 or idx >= len(row):
        return ""
    raw = row[idx]
    if raw is None:
        return ""
    return str(raw).strip()


def _is_product_row(
    row: list[Any],
    sku_idx: int | None,
    *,
    name_idx: int | None = None,
    model_idx: int | None = None,
) -> bool:
    if not row or not any(v is not None and str(v).strip() != "" for v in row):
        return False
    sku_val = _cell(row, sku_idx)
    if sku_val:
        return True
    # Empty / unmapped SKU: still accept when name/model looks like a product code (PTZ sheets).
    if looks_like_sku(_cell(row, model_idx)) or looks_like_sku(_cell(row, name_idx)):
        return True
    if sku_idx is not None:
        return False
    nonempty = [v for v in row if v is not None and str(v).strip() != ""]
    return len(nonempty) >= 2


def _sku_col(column_map: dict[str, str]) -> int | None:
    return _field_col(column_map, "sku")


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

    # PTZ / accessory sheets often put the model code in the name column with no SKU.
    if not commercial.get("sku"):
        for candidate in (commercial.get("model"), commercial.get("name")):
            if candidate is not None and looks_like_sku(str(candidate)):
                commercial["sku"] = str(candidate).strip()
                warnings.append("sku_from_name")
                if not commercial.get("model"):
                    commercial["model"] = commercial["sku"]
                break

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
        name_idx = _field_col(column_map, "name")
        model_idx = _field_col(column_map, "model")
        rows: list[list[Any]] = src.get("rows") or []
        for ri, row in enumerate(rows, start=1):
            if ri <= header_row:
                continue
            if not _is_product_row(row, sku_idx, name_idx=name_idx, model_idx=model_idx):
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
    *,
    in_file_mode: InFileDuplicateMode = "block",
) -> None:
    """Mutate candidates with duplicate_action: create|update|skip|none.

    Repeated SKUs in the same file:
    - block (default): later rows blocked as duplicate_sku_in_file
    - suffix: later rows get SKU-2 / SKU-3… and import as create (user-approved)
    """
    seen_in_file: set[str] = set()
    in_file_counts: dict[str, int] = {}
    mode = in_file_mode if in_file_mode in {"block", "suffix"} else "block"

    for c in candidates:
        if c["status"] == "blocked":
            c["duplicate_action"] = "none"
            continue
        product = c.get("product")
        if not isinstance(product, dict):
            c["duplicate_action"] = "none"
            continue
        sku = product.get("sku")
        if not sku:
            c["duplicate_action"] = "none"
            continue
        sku_key = str(sku).strip()
        if not sku_key:
            c["duplicate_action"] = "none"
            continue

        if sku_key in seen_in_file:
            c["is_duplicate"] = True
            if mode == "suffix":
                n = in_file_counts.get(sku_key, 1) + 1
                in_file_counts[sku_key] = n
                new_sku = f"{sku_key}-{n}"
                while new_sku in seen_in_file or new_sku in existing_skus:
                    n += 1
                    in_file_counts[sku_key] = n
                    new_sku = f"{sku_key}-{n}"
                product["sku"] = new_sku
                seen_in_file.add(new_sku)
                warnings = list(c.get("warnings") or [])
                if "sku_suffix_for_duplicate" not in warnings:
                    warnings.append("sku_suffix_for_duplicate")
                c["warnings"] = warnings
                reasons = [r for r in (c.get("block_reasons") or []) if r != "duplicate_sku_in_file"]
                c["block_reasons"] = reasons
                if c["status"] == "blocked" and not reasons:
                    c["status"] = "warning"
                elif c["status"] == "ready":
                    c["status"] = "warning"
                c["duplicate_action"] = "create"
                continue

            c["status"] = "blocked"
            reasons = list(c.get("block_reasons") or [])
            if "duplicate_sku_in_file" not in reasons:
                reasons.append("duplicate_sku_in_file")
            c["block_reasons"] = reasons
            c["duplicate_action"] = "none"
            continue

        seen_in_file.add(sku_key)
        in_file_counts[sku_key] = 1
        if sku_key in existing_skus:
            c["existing_id"] = existing_skus[sku_key]
            c["is_duplicate"] = True
            if policy == "update":
                c["duplicate_action"] = "update"
            else:
                # skip + new_only (and unknown): do not create a second row
                c["duplicate_action"] = "skip"
        else:
            c["is_duplicate"] = False
            c["duplicate_action"] = "create"


def apply_import_pricing(
    candidates: list[dict[str, Any]],
    *,
    mode: str,
    value: float | None,
    only_missing: bool = True,
) -> None:
    """Derive list_price from cost for import candidates (mutates in place)."""
    if mode in {"", "leave", "none", "manual"}:
        return
    if value is None or value <= 0:
        return
    for c in candidates:
        if c.get("status") == "blocked":
            continue
        product = c.get("product")
        if not isinstance(product, dict):
            continue
        cost = float(product.get("cost") or 0)
        if cost <= 0:
            continue
        current = float(product.get("list_price") or 0)
        if only_missing and current > 0:
            continue
        if mode == "markup_percent":
            product["list_price"] = round(cost * (1.0 + float(value) / 100.0), 2)
        elif mode == "multiplier":
            product["list_price"] = round(cost * float(value), 2)
        else:
            continue
        warnings = list(c.get("warnings") or [])
        if "list_price_from_cost" not in warnings:
            warnings.append("list_price_from_cost")
        c["warnings"] = warnings


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
