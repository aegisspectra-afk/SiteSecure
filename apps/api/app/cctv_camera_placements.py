"""B4: load camera placements from system_designs.requirements for forward flows."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from .rest import as_list


def normalize_placements(raw: object) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    for row in raw:
        if not isinstance(row, dict):
            continue
        count = max(0, int(row.get("count") or 0))
        if count < 1:
            continue
        env = row.get("environment")
        if env not in {"indoor", "outdoor", ""}:
            env = ""
        ff = row.get("formFactor") or row.get("form_factor") or ""
        if ff not in {"", "dome", "bullet", "turret", "ptz"}:
            ff = ""
        out.append(
            {
                "id": str(row.get("id") or f"loc-{len(out) + 1}"),
                "label": str(row.get("label") or "").strip(),
                "count": count,
                "environment": env,
                "formFactor": ff,
            }
        )
    return out


def load_placements_for_quote(client, workspace_id: UUID | str, quote_id: UUID | str) -> list[dict[str, Any]]:
    """Latest CCTV system design placements for a quote (empty if none)."""
    try:
        designs = as_list(
            client.get(
                "system_designs",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "quote_id": f"eq.{quote_id}",
                    "select": "id,requirements,updated_at,created_at",
                    "order": "updated_at.desc.nullslast,created_at.desc",
                    "limit": "1",
                },
            )
        )
    except Exception:
        return []
    if not designs:
        return []
    req = designs[0].get("requirements")
    form: dict = {}
    if isinstance(req, dict):
        if isinstance(req.get("form"), dict):
            form = req["form"]
        elif "cameraPlacements" in req:
            form = req
    return normalize_placements(form.get("cameraPlacements"))


def expand_location_notes(placements: list[dict[str, Any]], camera_slots: int) -> list[str]:
    """Assign location labels to N camera asset slots in placement order."""
    labels: list[str] = []
    for p in placements:
        label = (p.get("label") or "").strip() or "מיקום"
        for _ in range(int(p.get("count") or 0)):
            labels.append(label)
    if camera_slots <= len(labels):
        return labels[:camera_slots]
    # Pad remaining cameras without a named placement.
    while len(labels) < camera_slots:
        labels.append(f"מיקום {len(labels) + 1}")
    return labels


def checklist_rows_for_placements(
    *,
    workspace_id: str,
    job_id: str,
    placements: list[dict[str, Any]],
    template_key: str,
    sort_start: int,
) -> list[dict[str, Any]]:
    """One required photo checklist item per placement location."""
    rows: list[dict[str, Any]] = []
    for index, p in enumerate(placements):
        label = (p.get("label") or "").strip() or f"מיקום {index + 1}"
        count = int(p.get("count") or 1)
        rows.append(
            {
                "workspace_id": workspace_id,
                "job_id": job_id,
                "label_he": f"התקנת מצלמות · {label} ({count})",
                "help_he": "צלמו את המצלמות במיקום זה אחרי ההתקנה.",
                "required": True,
                "photo_required": True,
                "allow_na": False,
                "item_key": f"placement:{p.get('id') or index + 1}",
                "template_key": template_key,
                "sort_order": sort_start + index,
            }
        )
    return rows
