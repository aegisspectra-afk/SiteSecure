"""System Design persistence helpers — commercial-field stripping, no pricing."""

from __future__ import annotations

from typing import Any

COMMERCIAL_CANDIDATE_KEYS = frozenset({"cost", "list_price", "unit_price", "margin", "margin_percent"})
SELECTION_ORIGINS = frozenset({"ENGINE_PREFERRED", "USER_OVERRIDE", "UNSELECTED"})
LIFECYCLE_STATUSES = frozenset({"draft", "calculated", "applied"})
ENGINE_TYPES = frozenset({"cctv"})


def strip_commercial_keys(value: Any) -> Any:
    """Recursively drop cost/list_price (and similar) from JSON payloads."""
    if isinstance(value, list):
        return [strip_commercial_keys(item) for item in value]
    if isinstance(value, dict):
        out: dict[str, Any] = {}
        for key, item in value.items():
            if key in COMMERCIAL_CANDIDATE_KEYS:
                continue
            out[key] = strip_commercial_keys(item)
        return out
    return value


def sanitize_candidates(raw: Any) -> list[Any]:
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise ValueError("candidates must be a list")
    return strip_commercial_keys(raw)


def sanitize_json_object(raw: Any, *, field: str) -> dict[str, Any]:
    if raw is None:
        return {}
    if not isinstance(raw, dict):
        raise ValueError(f"{field} must be an object")
    return strip_commercial_keys(raw)


def sanitize_reason_codes(raw: Any) -> list[Any]:
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise ValueError("reason_codes must be a list")
    return strip_commercial_keys(raw)


def soft_delete_designs_for_quote(svc: Any, workspace_id: Any, quote_id: Any) -> None:
    """Stamp Designs when parent Quote is soft-deleted (CASCADE does not run)."""
    from datetime import UTC, datetime

    now = datetime.now(UTC).isoformat()
    try:
        svc.patch(
            "system_designs",
            {"deleted_at": now},
            params={
                "workspace_id": f"eq.{workspace_id}",
                "quote_id": f"eq.{quote_id}",
                "deleted_at": "is.null",
            },
            prefer="return=minimal",
        )
    except Exception:
        pass
