"""Server-side send gates + soft advisories. Client cannot bypass critical gates."""

from __future__ import annotations

from .quote_rules import (
    ADVISORY_RULES,
    CRITICAL_RULES,
    camera_recorder_capacity_rule,
    gap,
    margin_rule,
    run_rules,
)


def validate_for_send(
    quote: dict,
    items: list[dict],
    workspace: dict,
    settings: dict | None = None,
) -> list[dict]:
    gaps = run_rules(CRITICAL_RULES, quote, items, workspace, settings)
    return [g for g in gaps if g.get("severity", "critical") == "critical"]


def advisory_checks(
    quote: dict,
    items: list[dict],
    workspace: dict | None = None,
    settings: dict | None = None,
) -> list[dict]:
    """Non-blocking warnings/info + soft CCTV heuristics."""
    ws = workspace or {}
    soft_from_critical = run_rules(
        [camera_recorder_capacity_rule],
        quote,
        items,
        ws,
        settings,
    )
    soft = [g for g in soft_from_critical if g.get("severity") != "critical"]
    soft.extend(run_rules(ADVISORY_RULES, quote, items, ws, settings))
    return soft


def critical_gaps_only(gaps: list[dict]) -> list[dict]:
    return [row for row in gaps if row.get("severity", "critical") == "critical"]


def all_gaps(
    quote: dict,
    items: list[dict],
    workspace: dict,
    settings: dict | None = None,
) -> list[dict]:
    return [
        *validate_for_send(quote, items, workspace, settings),
        *advisory_checks(quote, items, workspace, settings),
    ]


__all__ = [
    "validate_for_send",
    "advisory_checks",
    "critical_gaps_only",
    "all_gaps",
    "gap",
    "margin_rule",
]
