"""P1-T02: capabilities / plan_capabilities registry (additive; no authorize changes)."""

from __future__ import annotations

import os

import httpx
import pytest

REQUIRED_CAPABILITIES = [
    ("field_service.enabled", "boolean"),
    ("field_service.monthly_work_orders", "integer"),
    ("field_service.advanced_scheduling", "boolean"),
    ("inspections.enabled", "boolean"),
    ("inspections.monthly_runs", "integer"),
    ("inspections.custom_templates", "boolean"),
    ("inspections.corrective_actions", "boolean"),
    ("inspections.patrol_checkpoints", "boolean"),
    ("workforce.enabled", "boolean"),
    ("workforce.max_people", "integer"),
    ("workforce.scheduling", "boolean"),
    ("workforce.certifications", "boolean"),
    ("site_ai.enabled", "boolean"),
    ("site_ai.monthly_usage", "integer"),
    ("site_ai.actions", "boolean"),
    ("site_ai.cross_module_analysis", "boolean"),
]

PLANS = ("solo", "business", "enterprise")


def _service() -> tuple[str, str] | None:
    url = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
    if not url or not key:
        return None
    return url, key


@pytest.fixture(scope="module")
def service_headers():
    creds = _service()
    if not creds:
        pytest.skip("SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required")
    url, key = creds
    return url, {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def test_capabilities_registry_seeded(service_headers):
    url, headers = service_headers
    r = httpx.get(
        f"{url}/rest/v1/capabilities",
        headers=headers,
        params={"select": "key,value_type", "order": "key"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    rows = {row["key"]: row["value_type"] for row in r.json()}
    for key, value_type in REQUIRED_CAPABILITIES:
        assert rows.get(key) == value_type, f"missing/wrong type for {key}"


def test_plan_capabilities_complete_matrix(service_headers):
    url, headers = service_headers
    r = httpx.get(
        f"{url}/rest/v1/plan_capabilities",
        headers=headers,
        params={"select": "plan_key,capability_key,enabled,limit_value,config", "order": "plan_key,capability_key"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    rows = {(row["plan_key"], row["capability_key"]): row for row in r.json()}
    for plan in PLANS:
        for key, value_type in REQUIRED_CAPABILITIES:
            row = rows.get((plan, key))
            assert row is not None, f"missing plan_capabilities {plan}/{key}"
            if value_type == "boolean":
                assert row["limit_value"] is None
            else:
                assert row["limit_value"] is not None
                assert int(row["limit_value"]) >= 0


def test_free_field_service_not_reduced(service_headers):
    """Solo/Free must keep field_service.enabled; monthly WO not inventing a finite cap."""
    url, headers = service_headers
    r = httpx.get(
        f"{url}/rest/v1/plan_capabilities",
        headers=headers,
        params={
            "select": "capability_key,enabled,limit_value,config",
            "plan_key": "eq.solo",
            "capability_key": "in.(field_service.enabled,field_service.monthly_work_orders)",
        },
        timeout=30,
    )
    assert r.status_code == 200, r.text
    by_key = {row["capability_key"]: row for row in r.json()}
    assert by_key["field_service.enabled"]["enabled"] is True
    wo = by_key["field_service.monthly_work_orders"]
    assert wo["enabled"] is True
    assert wo["limit_value"] == 0  # unlimited compat / TBD — not a silent Free reduction
    assert (wo.get("config") or {}).get("quota_status") == "tbd"


def test_legacy_features_and_plan_features_untouched(service_headers):
    url, headers = service_headers
    feats = httpx.get(
        f"{url}/rest/v1/features",
        headers=headers,
        params={"select": "key", "order": "key"},
        timeout=30,
    )
    assert feats.status_code == 200, feats.text
    keys = {row["key"] for row in feats.json()}
    for required in ("core", "crm", "service", "quotes", "ai", "team", "audit"):
        assert required in keys

    pf = httpx.get(
        f"{url}/rest/v1/plan_features",
        headers=headers,
        params={"select": "plan_key,feature_key", "plan_key": "eq.solo", "feature_key": "eq.service"},
        timeout=30,
    )
    assert pf.status_code == 200, pf.text
    assert pf.json(), "solo still includes legacy service feature"


def test_authenticated_cannot_mutate_capabilities(service_headers):
    """Service role can write; there is no authenticated INSERT policy (PostgREST returns error)."""
    url, headers = service_headers
    # Attempt insert with anon key if available — otherwise verify no INSERT policy via OPTIONS/docs.
    anon = os.environ.get("SUPABASE_ANON_KEY") or ""
    if not anon:
        pytest.skip("SUPABASE_ANON_KEY not set")
    r = httpx.post(
        f"{url}/rest/v1/capabilities",
        headers={
            "apikey": anon,
            "Authorization": f"Bearer {anon}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        json={"key": "p1t02.should_fail", "value_type": "boolean", "description": "x"},
        timeout=30,
    )
    assert r.status_code in {401, 403, 404, 42501} or r.status_code >= 400
