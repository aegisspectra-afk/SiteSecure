from __future__ import annotations

from datetime import UTC, datetime

from fastapi.testclient import TestClient

from app.authz.catalog import load_catalog
from app.authz.engine import authorize
from app.authz.types import AuthzContext
from app.dashboard import build_dashboard, home_variant
from app.main import app

NOW = datetime(2026, 8, 14, 12, 0, tzinfo=UTC)


def _ctx(role: str) -> AuthzContext:
    catalog = load_catalog()
    return AuthzContext(
        user_id="u-sales" if role == "sales" else "u1",
        workspace_id="w1",
        role_key=role,
        workspace_status="active",
        subscription_status="active",
        plan_key="business",
        features=catalog["_plan_features"]["business"],
        assigned_resource_ids=frozenset({"job-assigned", "site-assigned"}),
    )


def _names() -> dict[str, str]:
    return {"c1": "לקוח א", "s1": "אתר ב", "c2": "לקוח זר"}


def _quotes() -> list[dict]:
    return [
        {
            "id": "q-sent",
            "number": "Q-00012",
            "status": "sent",
            "customer_id": "c1",
            "site_id": "s1",
            "owner_user_id": "u-sales",
            "valid_until": "2026-08-20",
            "updated_at": "2026-08-13T10:00:00+00:00",
            "total_gross": 8400,
            "cost_total": 9999,
        },
        {
            "id": "q-viewed",
            "number": "Q-00018",
            "status": "viewed",
            "customer_id": "c1",
            "site_id": "s1",
            "owner_user_id": "u-other",
            "valid_until": "2026-12-01",
            "updated_at": "2026-08-13T10:00:00+00:00",
        },
        {
            "id": "q-owned-other",
            "number": "Q-00099",
            "status": "sent",
            "customer_id": "c2",
            "site_id": None,
            "owner_user_id": "u-other",
            "valid_until": "2026-08-16",
            "updated_at": "2026-08-01T10:00:00+00:00",
        },
    ]


def _jobs() -> list[dict]:
    return [
        {
            "id": "job-open",
            "number": "J-00004",
            "status": "scheduled",
            "customer_id": "c1",
            "site_id": "s1",
            "scheduled_for": "2026-08-14T09:00:00+00:00",
        },
        {
            "id": "job-assigned",
            "number": "J-00005",
            "status": "scheduled",
            "customer_id": "c1",
            "site_id": "s1",
            "scheduled_for": "2026-08-14T14:00:00+00:00",
        },
        {
            "id": "job-overdue",
            "number": "J-00006",
            "status": "scheduled",
            "customer_id": "c1",
            "site_id": "s1",
            "scheduled_for": "2026-08-13T09:00:00+00:00",
        },
    ]


def _build(role: str, **overrides):
    ctx = _ctx(role)
    kwargs = {
        "role_key": role,
        "user_id": ctx.user_id,
        "now": NOW,
        "quotes": _quotes(),
        "jobs": _jobs(),
        "job_assignees": {"job-assigned": {"u1"}},
        "assigned_resource_ids": ctx.assigned_resource_ids,
        "names": _names(),
        "events": [
            {
                "event_type": "approved",
                "quote_id": "q-sent",
                "quote_number": "Q-00010",
                "created_at": "2026-08-14T08:00:00+00:00",
            }
        ],
        "can_quotes_view": authorize(ctx=ctx, action="quotes.view").allowed,
        "can_jobs_view": authorize(ctx=ctx, action="jobs.view").allowed,
        "can_jobs_start": authorize(ctx=ctx, action="jobs.start").allowed,
        "can_jobs_complete": authorize(ctx=ctx, action="jobs.complete").allowed,
        "assignments_reliable": role in {"owner", "administrator", "manager"},
    }
    kwargs.update(overrides)
    return build_dashboard(**kwargs)


def test_approved_quotes_without_project_are_attention():
    quotes = _quotes() + [
        {
            "id": "q-approved",
            "number": "Q-00100",
            "status": "approved",
            "customer_id": "c1",
            "site_id": "s1",
            "owner_user_id": "u1",
            "valid_until": "2026-12-01",
            "updated_at": "2026-08-14T10:00:00+00:00",
            "total_gross": 1000,
        }
    ]
    payload = _build("owner", quotes=quotes, project_source_quote_ids=frozenset())
    pending = next(g for g in payload["attention"] if g["kind"] == "quote_approved_pending_project")
    assert pending["count"] == 1
    assert pending["items"][0]["entity_id"] == "q-approved"

    linked = _build("owner", quotes=quotes, project_source_quote_ids=frozenset({"q-approved"}))
    assert all(g["kind"] != "quote_approved_pending_project" for g in linked["attention"])


def test_home_variant_matrix():
    assert home_variant("owner") == "ops"
    assert home_variant("administrator") == "ops"
    assert home_variant("manager") == "ops"
    assert home_variant("sales") == "sales"
    assert home_variant("technician") == "today"
    assert home_variant("founding_technician") == "today"
    assert home_variant("viewer") == "observe"


def test_owner_attention_is_objects_not_kpis():
    payload = _build("owner")
    assert payload["home_variant"] == "ops"
    assert "kpis" not in payload
    assert "revenue" not in payload
    assert payload["summary"]["quotes_open"] >= 1
    assert payload["summary"]["quotes_open_value"] == 8400
    assert payload["recent_quotes"]
    awaiting = next(g for g in payload["attention"] if g["kind"] == "quote_awaiting_customer")
    assert awaiting["items"][0]["updated_at"]
    kinds = [g["kind"] for g in payload["attention"]]
    assert "quote_awaiting_customer" in kinds
    assert "job_unassigned" in kinds
    blob = str(payload)
    assert "9999" not in blob
    assert "cost_total" not in blob
    unassigned = next(g for g in payload["attention"] if g["kind"] == "job_unassigned")
    ids = {item["entity_id"] for item in unassigned["items"]}
    assert "job-open" in ids
    assert "job-assigned" not in ids


def test_sales_sees_only_owned_quotes_and_no_unassigned_jobs():
    payload = _build("sales")
    assert payload["home_variant"] == "sales"
    quote_ids = [item["entity_id"] for g in payload["attention"] for item in g["items"] if item["entity_type"] == "quote"]
    assert "q-sent" in quote_ids
    assert "q-owned-other" not in quote_ids
    assert "q-viewed" not in quote_ids
    assert all(g["kind"] != "job_unassigned" for g in payload["attention"])
    assert payload["today"]["items"] == []


def test_technician_today_hides_ops_quotes_and_start_is_real_action():
    payload = _build("technician")
    assert payload["home_variant"] == "today"
    assert payload["recent_quotes"] == []
    assert payload["attention"] == [] or all(g["kind"] != "quote_awaiting_customer" for g in payload["attention"])
    today_ids = {item["entity_id"] for item in payload["today"]["items"]}
    assert "job-assigned" in today_ids
    assert "job-open" not in today_ids
    assigned = next(item for item in payload["today"]["items"] if item["entity_id"] == "job-assigned")
    assert "start" in assigned["actions"]
    assert "create_customer" not in assigned["actions"]


def test_founding_technician_is_today_not_ops():
    payload = _build("founding_technician")
    assert payload["home_variant"] == "today"
    assert all(g["kind"] != "job_unassigned" for g in payload["attention"])


def test_viewer_has_no_mutation_actions():
    payload = _build("viewer")
    assert payload["home_variant"] == "observe"
    actions = [action for g in payload["attention"] for item in g["items"] for action in item["actions"]]
    actions += [action for item in payload["today"]["items"] for action in item["actions"]]
    assert actions == []
    assert authorize(ctx=_ctx("viewer"), action="crm.create").allowed is False
    assert authorize(ctx=_ctx("viewer"), action="jobs.start").allowed is False


def test_dashboard_requires_auth():
    client = TestClient(app)
    res = client.get("/api/v1/workspaces/00000000-0000-0000-0000-000000000001/dashboard")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "UNAUTHENTICATED"
