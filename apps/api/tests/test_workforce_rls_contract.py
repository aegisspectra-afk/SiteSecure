"""Contract: Workforce RLS least privilege (no live database required)."""

from __future__ import annotations

from pathlib import Path

from app.routers.workforce import _safe_audit_metadata

_REPO = Path(__file__).resolve().parents[3]
_RLS_MIGRATION = (
    _REPO / "supabase" / "migrations" / "20261020200000_workforce_rls_least_privilege.sql"
)
_FOUNDATION = _REPO / "supabase" / "migrations" / "20261020180000_workforce_intelligence_foundation.sql"
_SHIFTS = _REPO / "supabase" / "migrations" / "20261020210000_workforce_shifts_stage3.sql"
_STAGE4B = _REPO / "supabase" / "migrations" / "20261021120000_workforce_stage4b_staffing.sql"
_L1 = _REPO / "supabase" / "migrations" / "20261021150000_workforce_l1_rule_catalog.sql"
_L2 = _REPO / "supabase" / "migrations" / "20261021180000_workforce_l2_shifts_api_only.sql"
_PORTAL_SHIFTS = _REPO / "supabase" / "migrations" / "20261021190000_workforce_portal_own_shifts.sql"


def _sql() -> str:
    text = _RLS_MIGRATION.read_text(encoding="utf-8")
    assert "auth_has_workspace_grant" in text
    return text


def test_rls_migration_uses_existing_grant_tables():
    sql = _sql()
    assert "workspace_roles" in sql
    assert "role_permissions" in sql
    assert "auth_feature(workspace_id, 'workforce')" in sql
    assert "CREATE TABLE" not in sql


def test_employee_and_membership_writes_are_revoked_from_authenticated():
    sql = _sql()
    assert "REVOKE INSERT, UPDATE, DELETE ON TABLE public.workforce_employees FROM authenticated" in sql
    assert "REVOKE INSERT, UPDATE, DELETE ON TABLE public.workforce_memberships FROM authenticated" in sql
    assert "GRANT SELECT ON TABLE public.workforce_employees TO authenticated" in sql
    assert "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workforce_employees TO service_role" in sql
    create_policies = [line for line in sql.splitlines() if line.startswith("CREATE POLICY workforce_employees")]
    assert create_policies == [
        "CREATE POLICY workforce_employees_select ON public.workforce_employees"
    ]
    membership_policies = [line for line in sql.splitlines() if line.startswith("CREATE POLICY workforce_memberships")]
    assert membership_policies == [
        "CREATE POLICY workforce_memberships_select ON public.workforce_memberships"
    ]


def test_directory_writes_use_sites_manage_not_managerial():
    sql = _sql()
    write_chunk = sql.split("workforce_sites_insert", 1)[1]
    assert "auth_is_managerial" not in write_chunk
    assert "workforce.sites.manage" in sql
    assert "DROP POLICY IF EXISTS workforce_sites_write" in sql


def test_select_is_not_any_member():
    sql = _sql()
    foundation = _FOUNDATION.read_text(encoding="utf-8")
    assert "USING (public.auth_is_member(workspace_id));" in foundation
    assert "USING (public.auth_is_member(workspace_id));" not in sql
    assert "workforce.employees.view" in sql
    assert "workforce.portal.view" in sql
    assert "user_id = auth.uid()" in sql


def test_workspace_id_cannot_be_moved():
    sql = _sql()
    assert "WORKSPACE_ID_IMMUTABLE" in sql
    assert "workforce_employees_lock_workspace" in sql


def test_stage3_shifts_keep_employee_writes_revoked():
    sql = _SHIFTS.read_text(encoding="utf-8")
    assert "CREATE TABLE IF NOT EXISTS public.workforce_shifts" in sql
    assert "workforce.schedules.edit" in sql
    assert "REVOKE INSERT, UPDATE, DELETE ON TABLE public.workforce_employees FROM authenticated" in sql
    assert "REVOKE INSERT, UPDATE, DELETE ON TABLE public.workforce_memberships FROM authenticated" in sql
    assert "workforce_lock_workspace_id" in sql
    assert "CREATE TABLE" in sql and "workforce_shifts" in sql
    assert "CREATE TABLE IF NOT EXISTS public.ssp_sites" not in sql
    assert "CREATE TABLE public.sites" not in sql


def test_stage4b_separates_demand_from_assignment():
    sql = _STAGE4B.read_text(encoding="utf-8")
    assert "CREATE TABLE IF NOT EXISTS public.workforce_coverage_requirements" in sql
    assert "CREATE TABLE IF NOT EXISTS public.workforce_shift_slots" in sql
    assert "CREATE TABLE IF NOT EXISTS public.workforce_schedule_policies" in sql
    assert "CREATE TABLE IF NOT EXISTS public.workforce_time_off" in sql
    assert "CREATE TABLE IF NOT EXISTS public.workforce_qualifications" in sql
    assert "employee_id uuid NOT NULL" not in sql.split("workforce_shift_slots", 1)[1].split("CREATE TABLE", 1)[0]
    assert "ADD COLUMN IF NOT EXISTS slot_id" in sql
    assert "ADD COLUMN IF NOT EXISTS timezone" in sql
    assert "FORCE ROW LEVEL SECURITY" in sql
    assert "REVOKE INSERT, UPDATE, DELETE ON TABLE public.workforce_employees FROM authenticated" in sql
    assert "REVOKE INSERT, UPDATE, DELETE ON TABLE public.workforce_memberships FROM authenticated" in sql
    assert "CREATE TABLE IF NOT EXISTS public.ssp_sites" not in sql
    assert "CREATE TABLE public.sites" not in sql
    assert "workforce.schedules.edit" in sql
    shifts = _SHIFTS.read_text(encoding="utf-8")
    assert "employee_id uuid NOT NULL" in shifts


def test_l1_catalog_is_versioned_and_not_assignment_enforcement():
    sql = _L1.read_text(encoding="utf-8")
    assert "CREATE TABLE IF NOT EXISTS public.workforce_rules" in sql
    assert "CREATE TABLE IF NOT EXISTS public.workforce_legal_instruments" in sql
    assert "CREATE TABLE IF NOT EXISTS public.workforce_employment_profiles" in sql
    assert "verification_status" in sql
    assert "cannot_be_relaxed" in sql
    assert "WORKFORCE_RULE_VERSION_IMMUTABLE" in sql
    assert "workforce_rule_is_active_legal_block" in sql
    assert "workforce.settings.manage" in sql
    assert "FORCE ROW LEVEL SECURITY" in sql
    assert "Does not enforce legal blocks on shift save" in sql
    assert "REVOKE INSERT, UPDATE, DELETE ON TABLE public.workforce_employees FROM authenticated" in sql
    assert "CREATE TABLE IF NOT EXISTS public.ssp_sites" not in sql
    assert "CREATE TABLE public.sites" not in sql
    assert "rest_weekday" in sql
    assert "hours_law_covered" in sql


def test_portal_own_shifts_select_does_not_grant_org_board():
    sql = _PORTAL_SHIFTS.read_text(encoding="utf-8")
    assert "workforce.portal.view" in sql
    assert "e.user_id = (SELECT auth.uid())" in sql
    assert "workforce_shifts_select" in sql
    assert "GRANT INSERT" not in sql
    assert "workforce.schedules.view" in sql
    assert "CREATE TABLE" not in sql
    assert "CREATE TABLE IF NOT EXISTS public.ssp_sites" not in sql
    assert "CREATE TABLE public.sites" not in sql
    assert "Do not apply to cloud" in sql


def test_l2_shift_writes_are_revoked_from_authenticated():
    sql = _L2.read_text(encoding="utf-8")
    assert "REVOKE INSERT, UPDATE, DELETE ON TABLE public.workforce_shifts FROM authenticated" in sql
    assert "GRANT SELECT ON TABLE public.workforce_shifts TO authenticated" in sql
    assert "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workforce_shifts TO service_role" in sql
    assert "WITH CHECK (false)" in sql
    assert "FORCE ROW LEVEL SECURITY" in sql
    assert "REVOKE INSERT, UPDATE, DELETE ON TABLE public.workforce_employees FROM authenticated" in sql
    assert "CREATE TABLE IF NOT EXISTS public.ssp_sites" not in sql
    assert "CREATE TABLE public.sites" not in sql


def test_audit_metadata_strips_secrets():
    clean = _safe_audit_metadata(
        {
            "employee_id": "e1",
            "password": "Secret9x",
            "token": "abc",
            "username": "dana.k",
        }
    )
    assert clean == {"employee_id": "e1", "username": "dana.k"}
    assert "Secret9x" not in str(clean)
