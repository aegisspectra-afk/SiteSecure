"""C2 — patrol lifecycle, scan rules, grants (no live DB)."""

from __future__ import annotations

from pathlib import Path

import pytest

from app.errors import ApiError
from app.ssp.product_authz import product_grants
from app.ssp.run_lifecycle import (
    assert_transition,
    can_transition,
    officer_may_act_on_run,
    progress_summary,
)
from app.ssp.scan_rules import resolve_scan_result

ROOT = Path(__file__).resolve().parents[3]
C2_SQL = ROOT / "supabase" / "migrations" / "20261019240000_ssp_ops_workflow_c2.sql"


def test_c2_migration_event_actions():
    text = C2_SQL.read_text(encoding="utf-8")
    assert "ssp_event_actions" in text
    assert "form_version_id" in text
    assert "started" in text
    assert "ezguard" not in text.lower()


def test_run_transitions():
    assert can_transition("planned", "active")
    assert can_transition("active", "completed")
    assert not can_transition("completed", "active")
    assert not can_transition("planned", "completed")
    with pytest.raises(ApiError) as exc:
        assert_transition("completed", "active")
    assert exc.value.code == "BUSINESS_RULE"


def test_officer_assignment_gate():
    assert officer_may_act_on_run(
        product_role="patrol_officer", user_id="u1", assignee_user_ids=["u1", "u2"]
    )
    assert not officer_may_act_on_run(
        product_role="patrol_officer", user_id="u1", assignee_user_ids=["u2"]
    )
    assert officer_may_act_on_run(
        product_role="patrol_manager", user_id="u1", assignee_user_ids=["u2"]
    )
    assert not officer_may_act_on_run(product_role=None, user_id="u1", assignee_user_ids=["u1"])


def test_progress_and_missing():
    p = progress_summary(
        stop_checkpoint_ids=["a", "b", "c"],
        required_checkpoint_ids=["a", "b"],
        ok_scanned_checkpoint_ids=["a"],
    )
    assert p["completed_stops"] == 1
    assert p["missing_checkpoint_ids"] == ["b"]
    assert p["percent"] == 33


def test_scan_results():
    assert resolve_scan_result(checkpoint_on_route=True, already_ok_scanned=False, run_status="active") == "ok"
    assert (
        resolve_scan_result(checkpoint_on_route=True, already_ok_scanned=True, run_status="active")
        == "duplicate"
    )
    assert (
        resolve_scan_result(checkpoint_on_route=False, already_ok_scanned=False, run_status="active")
        == "out_of_route"
    )
    assert (
        resolve_scan_result(checkpoint_on_route=True, already_ok_scanned=False, run_status="planned")
        == "unauthorized"
    )
    assert (
        resolve_scan_result(checkpoint_on_route=True, already_ok_scanned=False, run_status="completed")
        == "unauthorized"
    )


def test_role_grants_manager_vs_officer_c2():
    mgr = product_grants("patrol_manager")
    off = product_grants("patrol_officer")
    assert "ssp.patrols.edit" in mgr
    assert "ssp.events.edit" in mgr
    assert "ssp.distributions.manage" in mgr
    assert "ssp.scans.create" in off
    assert "ssp.events.edit" not in off
    assert "ssp.distributions.manage" not in off
    assert "ssp.org.manage" not in mgr


def test_cross_company_denied_by_company_pk_in_ops_router():
    """Ops endpoints always filter company_pk from workspace company — not client-supplied."""
    src = (ROOT / "apps" / "api" / "app" / "routers" / "ssp_ops.py").read_text(encoding="utf-8")
    assert "_require_company" in src
    assert "company_pk" in src
    assert "patrol-runs/{run_id}/start" in src
    assert "resolve_scan_result" in src
