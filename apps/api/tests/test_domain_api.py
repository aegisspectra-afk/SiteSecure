import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.authz.engine import authorize
from app.authz.types import AuthzContext
from app.errors import ApiError
from app.main import app
from app.pagination import parse_limit
from app.routers.customers import CustomerCreate
from app.routers.quotes import QuoteCreate, QuotePatch
from app.supabase_user import UserClient


def test_openapi_and_health():
    client = TestClient(app)
    health = client.get("/health")
    assert health.status_code == 200
    spec = client.get("/api/openapi.json")
    assert spec.status_code == 200
    paths = spec.json()["paths"]
    for path in (
        "/api/v1/auth/session",
        "/api/v1/workspaces/{workspace_id}/customers",
        "/api/v1/workspaces/{workspace_id}/sites",
        "/api/v1/workspaces/{workspace_id}/jobs",
        "/api/v1/workspaces/{workspace_id}/quotes",
        "/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/recalculate",
        "/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/send",
        "/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/revise",
        "/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/apply-template",
        "/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/preview",
        "/api/v1/workspaces/{workspace_id}/catalog/products",
        "/api/v1/workspaces/{workspace_id}/catalog/categories",
        "/api/v1/public/quotes/{token}",
        "/api/v1/public/quotes/{token}/approve",
        "/api/v1/public/quotes/{token}/reject",
        "/api/v1/workspaces/{workspace_id}/documents/uploads",
        "/api/v1/workspaces/{workspace_id}/jobs/{job_id}/start",
        "/api/v1/workspaces/{workspace_id}/dashboard",
        "/api/v1/workspaces/{workspace_id}/members",
        "/api/v1/workspaces/{workspace_id}/usage",
        "/api/v1/workspaces/{workspace_id}/audit",
        "/api/v1/workspaces/{workspace_id}/security",
        "/api/v1/me",
        "/api/v1/authz/catalog",
    ):
        assert path in paths


def test_validation_rejects_unknown_money_fields():
    with pytest.raises(ValidationError):
        QuoteCreate(total_gross=1)  # type: ignore[call-arg]
    with pytest.raises(ValidationError):
        QuotePatch(subtotal_net=10)  # type: ignore[call-arg]
    with pytest.raises(ValidationError):
        CustomerCreate(display_name="x", workspace_id="ws")  # type: ignore[call-arg]
    client = TestClient(app)
    res = client.post(
        "/api/v1/workspaces/00000000-0000-0000-0000-000000000001/quotes",
        headers={"Authorization": "Bearer not-a-token"},
        json={"total_gross": 1},
    )
    assert res.status_code in {400, 401}


def test_pagination_limit_bounds():
    assert parse_limit(None) == 50
    assert parse_limit(100) == 100
    with pytest.raises(ApiError) as exc:
        parse_limit(101)
    assert exc.value.status_code == 400


def test_user_client_refuses_service_role_token():
    from app.config import Settings

    settings = Settings.model_construct(
        supabase_url="https://example.supabase.co",
        supabase_anon_key="anon",
        supabase_service_role_key="service-role-secret",
    )
    try:
        UserClient(settings, "service-role-secret")
        raise AssertionError("service role must not be usable as a user JWT")
    except Exception as exc:
        from app.errors import ApiError

        assert isinstance(exc, ApiError)
        assert exc.status_code == 401


def test_cost_permission_not_implied_by_quotes_view():
    from app.authz.catalog import load_catalog

    catalog = load_catalog()
    ctx = AuthzContext(
        user_id="u1",
        workspace_id="w1",
        role_key="sales",
        workspace_status="active",
        subscription_status="active",
        plan_key="business",
        features=catalog["_plan_features"]["business"],
    )
    assert authorize(ctx=ctx, action="quotes.view").allowed
    assert not authorize(ctx=ctx, action="quotes.view_cost").allowed
    assert authorize(ctx=ctx, action="quotes.create").allowed


def test_flatten_quote_customer_name():
    from app.routers.quotes import _flatten_quote

    named = _flatten_quote({"id": "q1", "customers": {"display_name": "רומן קופן"}})
    assert named["customer_name"] == "רומן קופן"
    assert "customers" not in named
    missing = _flatten_quote({"id": "q2", "customers": None})
    assert missing["customer_name"] is None
