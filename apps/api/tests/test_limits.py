"""Seat / quota limit helpers — Free (§8) + legacy solo alias."""

from app.authz.catalog import load_catalog
from app.authz.limits import evaluate_seat_limit, raise_plan_limit
from app.authz.usage import seat_meters, storage_meter, workspace_meters
from app.errors import ApiError

load_catalog.cache_clear()


def test_free_blocks_technician_capability():
    d = evaluate_seat_limit(plan_key="free", invite_role="technician", occupied_roles=["owner"])
    assert d.allowed is False
    assert d.code == "PLAN_LIMIT_REACHED"
    assert d.details.get("upgrade_required") is True


def test_solo_alias_matches_free_member_cap():
    d = evaluate_seat_limit(plan_key="solo", invite_role="sales", occupied_roles=["owner"])
    assert d.allowed is False
    assert d.code == "PLAN_LIMIT_REACHED"
    assert d.details["limit_key"] == "max_members"
    assert d.details["limit"] == 1


def test_free_member_cap_is_one():
    d = evaluate_seat_limit(plan_key="free", invite_role="viewer", occupied_roles=["owner"])
    assert d.allowed is False
    assert d.details["limit_key"] == "max_members"
    assert "צוות" in d.message_he or "חבר" in d.message_he


def test_raise_plan_limit_keeps_upgrade_flag():
    d = evaluate_seat_limit(plan_key="free", invite_role="technician", occupied_roles=["owner"])
    try:
        raise_plan_limit(d)
    except ApiError as exc:
        assert exc.status_code == 409
        assert exc.code == "PLAN_LIMIT_REACHED"
        assert exc.details.get("upgrade_required") is True
        return
    raise AssertionError("expected PLAN_LIMIT_REACHED")


def test_enterprise_zero_means_unlimited():
    d = evaluate_seat_limit(
        plan_key="enterprise",
        invite_role="technician",
        occupied_roles=["owner"] + ["technician"] * 50,
    )
    assert d.allowed is True


def test_business_member_cap_five():
    occupied = ["owner", "sales", "technician", "manager", "administrator"]
    denied = evaluate_seat_limit(plan_key="business", invite_role="viewer", occupied_roles=occupied)
    assert denied.allowed is False
    assert denied.details["limit_key"] == "max_members"
    assert denied.details["limit"] == 5
    try:
        raise_plan_limit(denied)
    except ApiError as exc:
        assert exc.status_code == 409
        return
    raise AssertionError("expected PLAN_LIMIT_REACHED on invite over cap")


def test_seat_meters_read_catalog_not_hardcoded():
    load_catalog.cache_clear()
    meters = {row["key"]: row for row in seat_meters(plan_key="free", occupied_roles=["owner"])}
    assert meters["seats_operator"]["current"] == 1
    assert meters["seats_operator"]["limit"] == 1
    assert meters["seats_operator"]["at_limit"] is True
    # Free: no field seats
    assert meters["seats_field"]["limit"] == 0
    assert meters["seats_field"]["unlimited"] is True  # 0 = unlimited in legacy meter; invite blocked by capability

    storage = storage_meter(plan_key="free", used_bytes=0)
    assert storage["key"] == "storage_gb"
    assert storage["unlimited"] is False
    assert storage["limit"] == 1 * (1024**3)

    combined = {
        row["key"]: row
        for row in workspace_meters(plan_key="free", occupied_roles=["owner"], used_bytes=1024)
    }
    assert combined["quota_quotes"]["current"] == 0
    assert combined["quota_quotes"]["limit"] == 10


def test_pro_storage_and_unlimited_quotes():
    meters = {
        row["key"]: row
        for row in workspace_meters(plan_key="pro", occupied_roles=["owner"], used_bytes=0, quotes_count=200)
    }
    assert meters["quota_quotes"]["unlimited"] is True
    assert meters["quota_quotes"]["at_limit"] is False
    assert meters["storage_gb"]["limit"] == 10 * (1024**3)


def test_free_quotes_at_monthly_cap():
    meters = {
        row["key"]: row
        for row in workspace_meters(
            plan_key="solo", occupied_roles=["owner"], used_bytes=0, quotes_count=10, customers_count=30
        )
    }
    assert meters["quota_quotes"]["at_limit"] is True
    assert meters["quota_clients"]["at_limit"] is True
