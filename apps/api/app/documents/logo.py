"""Attach company logo bytes to a document payload for PDF rendering."""

from __future__ import annotations

import base64
from typing import Any


def attach_logo_bytes(document: dict[str, Any], logo_bytes: bytes | None) -> dict[str, Any]:
    if not logo_bytes:
        return document
    company = dict(document.get("company") or {})
    company["logo_bytes_b64"] = base64.b64encode(logo_bytes).decode("ascii")
    out = dict(document)
    out["company"] = company
    return out


def resolve_logo_bytes(
    *,
    company: dict | None,
    download_fn,
) -> bytes | None:
    """download_fn(bucket, path) -> bytes | None"""
    if not isinstance(company, dict):
        return None
    path = str(company.get("logo_storage_path") or "").strip()
    bucket = str(company.get("logo_bucket") or "branding").strip() or "branding"
    if path:
        data = download_fn(bucket, path)
        if data:
            return data
    # Embedded preview (settings) may already carry bytes
    raw_b64 = company.get("logo_bytes_b64")
    if isinstance(raw_b64, str) and raw_b64:
        try:
            return base64.b64decode(raw_b64)
        except Exception:
            return None
    return None
