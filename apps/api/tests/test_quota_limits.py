from app.authz.limits import evaluate_count_limit, evaluate_storage_limit
from app.rest import _plan_limit_from_response
import httpx


def test_customer_quota_blocks_at_limit():
    d = evaluate_count_limit(
        plan_key="solo",
        limit_key="quota_clients",
        resource="customers",
        current=30,
    )
    assert d.allowed is False
    assert d.code == "PLAN_LIMIT_REACHED"
    assert d.details["resource"] == "customers"
    assert d.details["limit"] == 30
    assert d.details["current"] == 30


def test_customer_quota_allows_below_limit():
    d = evaluate_count_limit(
        plan_key="solo",
        limit_key="quota_clients",
        resource="customers",
        current=29,
    )
    assert d.allowed is True


def test_quote_quota_blocks_at_limit():
    d = evaluate_count_limit(
        plan_key="solo",
        limit_key="quota_quotes",
        resource="quotes",
        current=50,
    )
    assert d.allowed is False
    assert d.details["resource"] == "quotes"
    assert d.details["limit"] == 50


def test_enterprise_count_quota_unlimited():
    d = evaluate_count_limit(
        plan_key="enterprise",
        limit_key="quota_quotes",
        resource="quotes",
        current=10_000,
    )
    assert d.allowed is True
    assert evaluate_count_limit(
        plan_key="enterprise",
        limit_key="quota_clients",
        resource="customers",
        current=10_000,
    ).allowed is True


def test_zero_limit_means_unlimited_not_zero_allowed():
    d = evaluate_count_limit(
        plan_key="enterprise",
        limit_key="quota_clients",
        resource="customers",
        current=0,
        requested=1,
    )
    assert d.allowed is True


def test_storage_quota_blocks_over_remaining():
    limit = 15 * (1024**3)
    used = limit - 100
    d = evaluate_storage_limit(plan_key="solo", used_bytes=used, requested_bytes=200)
    assert d.allowed is False
    assert d.details["resource"] == "storage"
    assert d.details["limit"] == limit


def test_storage_quota_allows_exact_remaining():
    limit = 15 * (1024**3)
    used = limit - 100
    d = evaluate_storage_limit(plan_key="solo", used_bytes=used, requested_bytes=100)
    assert d.allowed is True


def test_enterprise_storage_unlimited():
    d = evaluate_storage_limit(
        plan_key="enterprise",
        used_bytes=10_000_000_000,
        requested_bytes=5_000_000_000,
    )
    assert d.allowed is True


def test_plan_limit_response_parser():
    res = httpx.Response(
        400,
        text='{"code":"P0001","message":"PLAN_LIMIT_REACHED:customers:30:30"}',
    )
    err = _plan_limit_from_response(res)
    assert err is not None
    assert err.code == "PLAN_LIMIT_REACHED"
    assert err.details["resource"] == "customers"
    assert err.details["limit"] == 30
    assert err.details["current"] == 30
