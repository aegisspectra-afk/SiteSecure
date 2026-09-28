"""Q8-C: expand project_planned_items (equipment) into installed Assets (`equipment`)."""

from __future__ import annotations

import re
from typing import Any

from .errors import ApiError
from .rest import as_list, created_or_403

EQUIPMENT_CATEGORY_PREFIX: dict[str, str] = {
    "camera": "CAM",
    "nvr": "NVR",
    "dvr": "DVR",
    "switch": "SW",
    "panel": "PNL",
    "reader": "RDR",
    "lock": "LCK",
    "pir": "PIR",
    "power": "PWR",
    "cable": "CBL",
    "sim": "SIM",
    "other": "EQ",
}

_VALID_CATEGORIES = frozenset(EQUIPMENT_CATEGORY_PREFIX)


def _text(value: object) -> str:
    return str(value or "").strip()


def _qty_int(value: object) -> int:
    try:
        n = float(value or 0)
    except (TypeError, ValueError):
        return 0
    if n <= 0:
        return 0
    return int(n)  # floor


def map_planned_to_equipment_category(planned: dict[str, Any]) -> str:
    """Deterministic map from commercial/planned text → equipment_category enum."""
    blob = " ".join(
        [
            _text(planned.get("sku")),
            _text(planned.get("name")),
            _text(planned.get("description")),
            _text(planned.get("section_name")),
            _text(planned.get("item_type")),
            _text(planned.get("manufacturer")),
            _text(planned.get("model")),
        ]
    ).lower()

    rules: list[tuple[str, tuple[str, ...]]] = [
        ("nvr", ("nvr", "network video", "מקליט", "רשם נתונים")),
        ("dvr", ("dvr",)),
        ("camera", ("camera", "cam ", "cam-", "מצלמ", "bullet", "dome", "turret", "ptz")),
        ("switch", ("switch", "poe", "מתג")),
        ("panel", ("panel", "לוח אזעקה", "alarm panel", "control panel")),
        ("reader", ("reader", "rfid", "קורא")),
        ("lock", ("lock", "מנעול", "maglock", "strike")),
        ("pir", ("pir", "motion", "גלא")),
        ("power", ("ups", "psu", "power", "ספק כוח", "סוללה")),
        ("cable", ("cable", "cat6", "cat5", "כבל", "utm")),
        ("sim", ("sim",)),
    ]
    for category, needles in rules:
        if any(n in blob for n in needles):
            return category
    return "other"


def asset_code_prefix(category: str) -> str:
    return EQUIPMENT_CATEGORY_PREFIX.get(category if category in _VALID_CATEGORIES else "other", "EQ")


def _parse_code_index(code: str, prefix: str) -> int | None:
    m = re.fullmatch(rf"{re.escape(prefix)}-(\d+)", code.strip(), flags=re.IGNORECASE)
    if not m:
        return None
    try:
        return int(m.group(1))
    except ValueError:
        return None


def next_asset_code_candidates(
    existing_codes: list[str],
    *,
    category: str,
    count: int,
    start_after: int | None = None,
) -> list[str]:
    """Pure helper: propose sequential codes after the highest existing prefix index."""
    prefix = asset_code_prefix(category)
    highest = start_after or 0
    for code in existing_codes:
        idx = _parse_code_index(str(code or ""), prefix)
        if idx is not None and idx > highest:
            highest = idx
    return [f"{prefix}-{highest + i:03d}" for i in range(1, count + 1)]


def _load_site_prefix_codes(client: Any, workspace_id: str, site_id: str, prefix: str) -> list[str]:
    rows = as_list(
        client.get(
            "equipment",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "site_id": f"eq.{site_id}",
                "asset_code": f"like.{prefix}-*",
                "select": "asset_code",
                "limit": "2000",
            },
        )
    )
    return [str(r.get("asset_code") or "") for r in rows if r.get("asset_code")]


def allocate_asset_code(
    client: Any,
    *,
    workspace_id: str,
    site_id: str,
    category: str,
    reserved: set[str] | None = None,
    max_attempts: int = 32,
) -> str:
    """Propose next site-local code. Caller must retry insert on unique collision."""
    prefix = asset_code_prefix(category)
    existing = set(_load_site_prefix_codes(client, workspace_id, site_id, prefix))
    if reserved:
        existing |= {c for c in reserved if c.upper().startswith(prefix.upper() + "-")}
    highest = 0
    for code in existing:
        idx = _parse_code_index(code, prefix)
        if idx is not None and idx > highest:
            highest = idx
    candidate_n = highest + 1
    for _ in range(max_attempts):
        code = f"{prefix}-{candidate_n:03d}"
        if code not in existing and code.upper() not in {e.upper() for e in existing}:
            return code
        candidate_n += 1
    raise ApiError(
        409,
        "RESOURCE_STATE",
        "לא ניתן להקצות קוד נכס פנוי באתר",
        details={"prefix": prefix},
    )


def display_name_for_asset(planned: dict[str, Any], *, index: int, total: int) -> str:
    base = _text(planned.get("name")) or _text(planned.get("description")) or _text(planned.get("sku")) or "ציוד"
    if total <= 1:
        return base[:200]
    return f"{base} ({index}/{total})"[:200]


def count_assets_for_planned_item(client: Any, workspace_id: str, planned_item_id: str) -> int:
    rows = as_list(
        client.get(
            "equipment",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "project_planned_item_id": f"eq.{planned_item_id}",
                "select": "id",
                "limit": "2000",
            },
        )
    )
    return len(rows)


def count_assets_by_planned_item(
    client: Any,
    workspace_id: str,
    project_id: str,
) -> dict[str, int]:
    rows = as_list(
        client.get(
            "equipment",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "project_id": f"eq.{project_id}",
                "select": "id,project_planned_item_id",
                "limit": "5000",
            },
        )
    )
    counts: dict[str, int] = {}
    for row in rows:
        key = str(row.get("project_planned_item_id") or "")
        if not key:
            continue
        counts[key] = counts.get(key, 0) + 1
    return counts


def build_create_plan(
    planned_items: list[dict[str, Any]],
    created_counts: dict[str, int],
) -> list[dict[str, Any]]:
    """Eligible equipment lines with remaining qty to materialize."""
    plan: list[dict[str, Any]] = []
    for item in planned_items:
        if str(item.get("scope_kind") or "") != "equipment":
            continue
        qty = _qty_int(item.get("qty"))
        if qty <= 0:
            continue
        pid = str(item.get("id") or "")
        if not pid:
            continue
        existing = int(created_counts.get(pid) or 0)
        remaining = max(0, qty - existing)
        category = map_planned_to_equipment_category(item)
        plan.append(
            {
                "planned_item": item,
                "planned_item_id": pid,
                "qty": qty,
                "existing": existing,
                "remaining": remaining,
                "category": category,
                "label": _text(item.get("name"))
                or _text(item.get("description"))
                or _text(item.get("sku"))
                or "ציוד",
            }
        )
    return plan


def _is_unique_violation(res: Any) -> bool:
    if getattr(res, "status_code", None) not in {409, 23505, 400}:
        # PostgREST often returns 409; some stacks use 400 with code 23505.
        if getattr(res, "status_code", None) != 400:
            return False
    try:
        body = res.json()
    except Exception:
        body = {}
    if not isinstance(body, dict):
        return False
    code = str(body.get("code") or "")
    msg = str(body.get("message") or "").lower()
    details = str(body.get("details") or "").lower()
    return (
        code == "23505"
        or "duplicate" in msg
        or "unique" in msg
        or "equipment_site_asset_code" in details
        or "asset_code" in details
    )


def insert_equipment_asset(
    client: Any,
    *,
    workspace_id: str,
    site_id: str,
    project_id: str,
    planned: dict[str, Any],
    category: str,
    asset_code: str,
    name: str,
) -> dict:
    """Insert one Asset. Raises ApiError(409) on asset_code collision for retry."""
    payload = {
        "workspace_id": workspace_id,
        "site_id": site_id,
        "project_id": project_id,
        "project_planned_item_id": str(planned.get("id")),
        "product_id": str(planned["product_id"]) if planned.get("product_id") else None,
        "asset_code": asset_code,
        "name": name,
        "category": category if category in _VALID_CATEGORIES else "other",
        "status": "installed",
        "manufacturer": _text(planned.get("manufacturer")) or None,
        "model": _text(planned.get("model")) or None,
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    res = client.post("equipment", payload)
    if res.status_code in {200, 201}:
        return created_or_403(res)
    if _is_unique_violation(res):
        raise ApiError(409, "CONFLICT", "asset_code collision", details={"asset_code": asset_code})
    return created_or_403(res)


def create_one_asset_with_code_retry(
    client: Any,
    *,
    workspace_id: str,
    site_id: str,
    project_id: str,
    planned: dict[str, Any],
    category: str,
    name: str,
    reserved_codes: set[str] | None = None,
    max_attempts: int = 10,
) -> dict:
    reserved = reserved_codes if reserved_codes is not None else set()
    last_err: ApiError | None = None
    for _ in range(max_attempts):
        code = allocate_asset_code(
            client,
            workspace_id=workspace_id,
            site_id=site_id,
            category=category,
            reserved=reserved,
        )
        reserved.add(code)
        try:
            row = insert_equipment_asset(
                client,
                workspace_id=workspace_id,
                site_id=site_id,
                project_id=project_id,
                planned=planned,
                category=category,
                asset_code=code,
                name=name,
            )
            return row
        except ApiError as exc:
            if exc.status_code == 409 and exc.code == "CONFLICT":
                last_err = exc
                continue
            reserved.discard(code)
            raise
    raise last_err or ApiError(409, "RESOURCE_STATE", "לא ניתן להקצות קוד נכס פנוי באתר")


def create_installed_assets_from_plan(
    client: Any,
    *,
    workspace_id: str,
    site_id: str,
    project_id: str,
    planned_items: list[dict[str, Any]],
) -> dict[str, Any]:
    """Idempotent materialization. Returns requested/created/already_existing/failed."""
    created_counts = count_assets_by_planned_item(client, workspace_id, project_id)
    lines = build_create_plan(planned_items, created_counts)
    requested = sum(int(line["remaining"]) for line in lines)
    already = sum(int(line["existing"]) for line in lines)
    if requested <= 0:
        return {
            "requested": 0,
            "created": 0,
            "already_existing": already,
            "failed": 0,
            "fully_materialized": True,
            "equipment_ids": [],
            "lines": [
                {
                    "planned_item_id": line["planned_item_id"],
                    "label": line["label"],
                    "qty": line["qty"],
                    "existing": line["existing"],
                    "created_now": 0,
                    "category": line["category"],
                }
                for line in lines
            ],
            "message": "הציוד כבר נוצר",
        }

    equipment_ids: list[str] = []
    failed = 0
    line_results: list[dict[str, Any]] = []
    created_total = 0
    reserved_codes: set[str] = set()

    for line in lines:
        remaining = int(line["remaining"])
        created_now = 0
        planned = line["planned_item"]
        category = line["category"]
        qty = int(line["qty"])
        existing = int(line["existing"])
        for i in range(remaining):
            index = existing + i + 1
            try:
                row = create_one_asset_with_code_retry(
                    client,
                    workspace_id=workspace_id,
                    site_id=site_id,
                    project_id=project_id,
                    planned=planned,
                    category=category,
                    name=display_name_for_asset(planned, index=index, total=qty),
                    reserved_codes=reserved_codes,
                )
                if row.get("id"):
                    equipment_ids.append(str(row["id"]))
                    created_now += 1
                    created_total += 1
                    if row.get("asset_code"):
                        reserved_codes.add(str(row["asset_code"]))
                else:
                    failed += 1
            except Exception:
                failed += 1
        line_results.append(
            {
                "planned_item_id": line["planned_item_id"],
                "label": line["label"],
                "qty": qty,
                "existing": existing,
                "created_now": created_now,
                "category": category,
            }
        )

    fully = failed == 0 and all(
        int(r["existing"]) + int(r["created_now"]) >= int(r["qty"]) for r in line_results
    )
    return {
        "requested": requested,
        "created": created_total,
        "already_existing": already,
        "failed": failed,
        "fully_materialized": bool(fully),
        "equipment_ids": equipment_ids,
        "lines": line_results,
        "message": (
            f"נוצרו {created_total} פריטי ציוד"
            if created_total
            else ("הציוד כבר נוצר" if requested == 0 else "יצירת הציוד נכשלה חלקית")
        ),
    }
