"""Customer-facing extras for the public quote page (Q6B)."""

from __future__ import annotations

from typing import Any


def _int(value: object) -> int | None:
    try:
        n = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    return n if n > 0 else None


def plain_cctv_system_summary(requirements: dict[str, Any] | None) -> str | None:
    """One plain-Hebrew line from CCTV design requirements, or None."""
    if not isinstance(requirements, dict) or not requirements:
        return None
    # Accept both camelCase (UI) and snake_case (engine normalize).
    cams = _int(requirements.get("cameraCount")) or _int(requirements.get("camera_count"))
    if cams is None:
        return None
    retention = _int(requirements.get("retentionDays")) or _int(requirements.get("retention_days"))
    env = str(requirements.get("environment") or "").strip().lower()
    env_he = {
        "indoor": "בפנים",
        "outdoor": "בחוץ",
        "indoor_outdoor": "בפנים ובחוץ",
    }.get(env)
    parts = [f"מערכת מצלמות עם {cams} מצלמות"]
    if env_he:
        parts.append(env_he)
    if retention:
        parts.append(f"שמירת הקלטה ל־{retention} ימים")
    # "מערכת מצלמות עם 8 מצלמות בפנים, שמירת הקלטה ל־14 ימים"
    if len(parts) == 1:
        return parts[0] + "."
    head, *rest = parts
    return f"{head} {rest[0]}" + (f", {', '.join(rest[1:])}" if len(rest) > 1 else "") + "."


def load_cctv_system_summary(svc: Any, workspace_id: object, quote_id: object) -> str | None:
    try:
        from .rest import as_list

        rows = as_list(
            svc.get(
                "system_designs",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "quote_id": f"eq.{quote_id}",
                    "engine_type": "eq.cctv",
                    "deleted_at": "is.null",
                    "select": "requirements,lifecycle_status,updated_at",
                    "order": "updated_at.desc",
                    "limit": "1",
                },
            )
        )
    except Exception:
        return None
    if not rows:
        return None
    req = rows[0].get("requirements")
    return plain_cctv_system_summary(req if isinstance(req, dict) else None)


def item_thumbnail_url(item: dict[str, Any] | None) -> str | None:
    if not isinstance(item, dict):
        return None
    for key in ("image_url", "thumbnail_url", "photo_url", "media_url"):
        raw = item.get(key)
        if isinstance(raw, str) and raw.startswith(("http://", "https://", "data:image/")):
            return raw
    snap = item.get("catalog_snapshot")
    if isinstance(snap, dict):
        for key in ("image_url", "thumbnail_url", "photo_url", "imageUrl", "thumbnailUrl"):
            raw = snap.get(key)
            if isinstance(raw, str) and raw.startswith(("http://", "https://", "data:image/")):
                return raw
        meta = snap.get("metadata")
        if isinstance(meta, dict):
            for key in ("image_url", "thumbnail_url", "photo_url"):
                raw = meta.get(key)
                if isinstance(raw, str) and raw.startswith(("http://", "https://", "data:image/")):
                    return raw
    return None


def attach_item_thumbnails(public: dict[str, Any]) -> None:
    items = public.get("items")
    if not isinstance(items, list):
        return
    for item in items:
        if not isinstance(item, dict):
            continue
        url = item_thumbnail_url(item)
        if url:
            item["thumbnail_url"] = url
