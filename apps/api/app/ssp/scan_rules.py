"""Checkpoint scan result rules (pure — unit-tested without DB)."""

from __future__ import annotations


def resolve_scan_result(
    *,
    checkpoint_on_route: bool | None,
    already_ok_scanned: bool,
    run_status: str | None,
) -> str:
    """
    Returns result code:
      ok | duplicate | out_of_route | unauthorized | error
    QR/code alone never grants authorization — caller must gate permissions first.
    """
    if run_status is not None and run_status not in {"active", "late"}:
        return "unauthorized"
    if already_ok_scanned:
        return "duplicate"
    if checkpoint_on_route is False:
        return "out_of_route"
    return "ok"
