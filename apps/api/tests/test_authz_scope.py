from __future__ import annotations

from app.authz.scope import (
    apply_assigned_column_filter,
    apply_assigned_job_list_filter,
    apply_assigned_task_list_filter,
    empty_assigned_page,
    is_assigned_scope,
)
from app.authz.types import AuthzContext


def _ctx(role: str, assigned: tuple[str, ...] = ()) -> AuthzContext:
    return AuthzContext(
        user_id="u1",
        workspace_id="w1",
        role_key=role,
        workspace_status="active",
        subscription_status="active",
        plan_key="business",
        features=frozenset({"core", "crm", "quotes", "projects", "service", "settings"}),
        assigned_resource_ids=frozenset(assigned),
    )


def test_is_assigned_scope_technician_only():
    assert is_assigned_scope(_ctx("technician")) is True
    assert is_assigned_scope(_ctx("owner")) is False
    assert is_assigned_scope(_ctx("viewer")) is False


def test_empty_assigned_page():
    assert empty_assigned_page(_ctx("technician")) == {"items": [], "next_cursor": None}
    assert empty_assigned_page(_ctx("technician", assigned=("a",))) is None
    assert empty_assigned_page(_ctx("owner")) is None


def test_apply_assigned_filters():
    params: dict[str, str] = {"workspace_id": "eq.w1"}
    apply_assigned_column_filter(_ctx("technician", assigned=("s1", "s2")), params, column="id")
    assert "and" in params
    assert "id.in.(s1,s2)" in params["and"]

    job_params: dict[str, str] = {"workspace_id": "eq.w1"}
    apply_assigned_job_list_filter(_ctx("technician", assigned=("j1", "s9")), job_params)
    assert "or(id.in.(j1,s9),site_id.in.(j1,s9))" in job_params["and"]

    owner_params: dict[str, str] = {"workspace_id": "eq.w1"}
    apply_assigned_job_list_filter(_ctx("owner", assigned=("j1",)), owner_params)
    assert owner_params == {"workspace_id": "eq.w1"}


def test_assigned_task_filter_is_assignee_only_even_with_site_customer():
    params: dict[str, str] = {"workspace_id": "eq.w1"}
    apply_assigned_task_list_filter(
        _ctx("technician", assigned=("site-1", "cust-1")),
        params,
    )
    assert "assignee_id.eq.u1" in params["and"]
    assert "site_id.in." not in params["and"]
    assert "customer_id.in." not in params["and"]

    owner_params: dict[str, str] = {"workspace_id": "eq.w1"}
    apply_assigned_task_list_filter(_ctx("owner", assigned=("site-1",)), owner_params)
    assert owner_params == {"workspace_id": "eq.w1"}
