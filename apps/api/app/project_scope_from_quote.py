"""Map a frozen quote_versions.snapshot into Project planned-scope rows.

Q8-B rules:
- Source = pinned snapshot only (never live quote_items).
- Skip notes.
- Skip optional lines (no customer optional-acceptance mechanism yet).
- Preserve labor/service as scope_kind=labor (not future Assets).
"""

from __future__ import annotations

from typing import Any


def _text(value: object) -> str:
    return str(value or "").strip()


def _num(value: object) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _section_name_map(sections: list[dict] | None) -> dict[str, str]:
    out: dict[str, str] = {}
    for section in sections or []:
        sid = section.get("id")
        if not sid:
            continue
        name = _text(section.get("name"))
        if name:
            out[str(sid)] = name
    return out


def classify_scope_kind(item: dict[str, Any]) -> str:
    """equipment | labor | other — labor must stay distinguishable from physical gear."""
    item_type = _text(item.get("item_type")).lower() or "catalog"
    if item_type in {"service", "labor"}:
        return "labor"
    snap = item.get("catalog_snapshot") if isinstance(item.get("catalog_snapshot"), dict) else {}
    kind = _text(snap.get("kind")).lower()
    if kind in {"service", "labor"}:
        return "labor"
    # catalog / custom / free / package / unknown physical → equipment (Assets prep).
    return "equipment"


def should_include_quote_item(item: dict[str, Any]) -> bool:
    item_type = _text(item.get("item_type")).lower()
    if item_type == "note":
        return False
    if bool(item.get("is_optional")):
        return False
    if _num(item.get("qty")) <= 0:
        return False
    return True


def plan_project_scope_from_snapshot(
    *,
    snapshot: dict[str, Any] | None,
    workspace_id: str,
    project_id: str,
    source_quote_id: str,
    source_quote_version: int,
) -> list[dict[str, Any]]:
    """Pure mapping: frozen snapshot → insert payloads for project_planned_items."""
    if not isinstance(snapshot, dict):
        return []
    items = snapshot.get("items")
    if not isinstance(items, list):
        # Fallback to public.items if staff items missing (older/odd snapshots).
        public = snapshot.get("public") if isinstance(snapshot.get("public"), dict) else {}
        items = public.get("items") if isinstance(public.get("items"), list) else []
    sections = snapshot.get("sections") if isinstance(snapshot.get("sections"), list) else []
    section_names = _section_name_map(sections)

    rows: list[dict[str, Any]] = []
    for index, raw in enumerate(items):
        if not isinstance(raw, dict):
            continue
        if not should_include_quote_item(raw):
            continue
        item_type = _text(raw.get("item_type")) or "catalog"
        scope_kind = classify_scope_kind(raw)
        snap = raw.get("catalog_snapshot") if isinstance(raw.get("catalog_snapshot"), dict) else {}
        section_id = raw.get("section_id")
        section_key = str(section_id) if section_id else ""
        name = _text(raw.get("name")) or _text(snap.get("name"))
        description = _text(raw.get("description")) or _text(snap.get("description")) or name
        sku = _text(raw.get("sku")) or _text(snap.get("sku")) or None
        unit = _text(raw.get("unit")) or _text(snap.get("unit")) or None
        manufacturer = _text(raw.get("manufacturer")) or _text(snap.get("manufacturer")) or None
        model = _text(raw.get("model")) or _text(snap.get("model")) or None
        product_id = raw.get("product_id") or snap.get("product_id")
        sort_order = raw.get("sort_order")
        try:
            sort_order_i = int(sort_order) if sort_order is not None else (index + 1) * 10
        except (TypeError, ValueError):
            sort_order_i = (index + 1) * 10
        source_item_id = raw.get("id")
        row: dict[str, Any] = {
            "workspace_id": str(workspace_id),
            "project_id": str(project_id),
            "source_quote_id": str(source_quote_id),
            "source_quote_version": int(source_quote_version),
            "source_quote_item_id": str(source_item_id) if source_item_id else None,
            "section_id": str(section_id) if section_id else None,
            "section_name": section_names.get(section_key) or None,
            "item_type": item_type,
            "scope_kind": scope_kind,
            "product_id": str(product_id) if product_id else None,
            "sku": sku,
            "name": name or None,
            "description": description or name or "פריט",
            "qty": round(_num(raw.get("qty")), 3),
            "unit": unit,
            "manufacturer": manufacturer,
            "model": model,
            "is_optional": False,
            "sort_order": sort_order_i,
        }
        rows.append({k: v for k, v in row.items() if v is not None})
    rows.sort(key=lambda r: (int(r.get("sort_order") or 0), str(r.get("description") or "")))
    return rows
