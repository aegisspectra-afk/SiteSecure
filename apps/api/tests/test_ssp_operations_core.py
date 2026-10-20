"""SSP unified operations — grants, codes, migration presence (no live DB)."""

from __future__ import annotations

from pathlib import Path

from app.ssp.ops_ids import CHECKPOINT_CODE_RE, is_valid_checkpoint_code, new_checkpoint_code
from app.ssp.product_authz import product_grants

ROOT = Path(__file__).resolve().parents[3]
OPS_SQL = ROOT / "supabase" / "migrations" / "20261019230000_ssp_operations_core.sql"


def test_ops_migration_defines_tables_not_ezguard():
    text = OPS_SQL.read_text(encoding="utf-8")
    assert "ssp_checkpoints" in text
    assert "ssp_patrols" in text
    assert "ssp_patrol_runs" in text
    assert "ssp_checkpoint_scans" in text
    assert "ssp_events" in text
    assert "ssp_form_distributions" in text
    assert "ezguard" not in text.lower()
    assert "create_workspace" not in text


def test_checkpoint_code_format():
    a = new_checkpoint_code()
    b = new_checkpoint_code()
    assert a != b
    assert is_valid_checkpoint_code(a)
    assert CHECKPOINT_CODE_RE.fullmatch(a)
    assert not is_valid_checkpoint_code("cp_short")


def test_manager_ops_grants_officer_limited():
    mgr = product_grants("patrol_manager")
    off = product_grants("patrol_officer")
    assert "ssp.patrols.edit" in mgr
    assert "ssp.checkpoints.edit" in mgr
    assert "ssp.distributions.manage" in mgr
    assert "ssp.patrols.edit" not in off
    assert "ssp.scans.create" in off
    assert "ssp.events.create" in off
    assert "ssp.org.manage" not in mgr


def test_no_ezguard_in_ssp_app_sources():
    ssp_root = ROOT / "apps" / "ssp" / "src"
    for path in ssp_root.rglob("*"):
        if path.suffix not in {".ts", ".tsx", ".mts", ".json"}:
            continue
        body = path.read_text(encoding="utf-8").lower()
        assert "ezguard" not in body, path
