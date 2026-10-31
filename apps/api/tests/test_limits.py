from app.authz.limits import evaluate_seat_limit


def test_solo_field_seat_allows_first_technician():
    d = evaluate_seat_limit(plan_key="solo", invite_role="technician", occupied_roles=["owner"])
    assert d.allowed is True


def test_solo_field_seat_blocks_at_catalog_cap():
    d = evaluate_seat_limit(
        plan_key="solo",
        invite_role="technician",
        occupied_roles=["owner", "technician", "technician", "viewer"],
    )
    assert d.allowed is False
    assert d.code == "PLAN_LIMIT_REACHED"
    assert d.details["limit"] == 3
    assert d.details["limit_key"] == "seats_field"
    assert "שטח" in d.message_he
    assert f"{d.details['current']}/{d.details['limit']}" in d.message_he
    assert d.message_he != "הגעתם למגבלת התוכנית הנוכחית"


def test_solo_operator_seat_is_full_with_owner():
    d = evaluate_seat_limit(plan_key="solo", invite_role="sales", occupied_roles=["owner"])
    assert d.allowed is False
    assert d.code == "PLAN_LIMIT_REACHED"
    assert d.details["limit_key"] == "seats_operator"
    assert "משרד" in d.message_he


def test_raise_plan_limit_keeps_named_seat_copy():
    from app.authz.limits import raise_plan_limit
    from app.errors import ApiError

    d = evaluate_seat_limit(
        plan_key="solo",
        invite_role="technician",
        occupied_roles=["owner", "technician", "technician", "viewer"],
    )
    try:
        raise_plan_limit(d)
    except ApiError as exc:
        assert exc.status_code == 409
        assert exc.code == "PLAN_LIMIT_REACHED"
        assert exc.details["limit_key"] == "seats_field"
        assert "שטח" in exc.message
        return
    raise AssertionError("expected PLAN_LIMIT_REACHED")


def test_enterprise_zero_means_unlimited():
    d = evaluate_seat_limit(
        plan_key="enterprise",
        invite_role="technician",
        occupied_roles=["owner"] + ["technician"] * 50,
    )
    assert d.allowed is True


def test_invite_enforcement_matches_catalog_caps():
    """Single source of truth: catalog.json seats_* — invite path uses evaluate_seat_limit + 409."""
    from app.authz.catalog import load_catalog
    from app.authz.limits import raise_plan_limit
    from app.errors import ApiError

    load_catalog.cache_clear()
    catalog = load_catalog()
    solo = next(plan for plan in catalog["plans"] if plan["key"] == "solo")
    field_cap = int(solo["limits"]["seats_field"])
    occupied = ["owner"] + ["technician"] * field_cap
    denied = evaluate_seat_limit(plan_key="solo", invite_role="technician", occupied_roles=occupied)
    assert denied.allowed is False
    assert denied.details["limit_key"] == "seats_field"
    assert denied.details["limit"] == field_cap
    try:
        raise_plan_limit(denied)
    except ApiError as exc:
        assert exc.status_code == 409
        assert exc.code == "PLAN_LIMIT_REACHED"
        return
    raise AssertionError("expected PLAN_LIMIT_REACHED on invite over cap")


def test_seat_meters_read_catalog_not_hardcoded_fives():
    from app.authz.catalog import load_catalog
    from app.authz.usage import seat_meters, storage_meter, workspace_meters

    load_catalog.cache_clear()
    meters = {row["key"]: row for row in seat_meters(plan_key="solo", occupied_roles=["owner"])}
    assert meters["seats_operator"]["current"] == 1
    assert meters["seats_operator"]["limit"] == 1
    assert meters["seats_operator"]["at_limit"] is True
    assert meters["seats_field"]["current"] == 0
    assert meters["seats_field"]["limit"] == 3
    assert meters["seats_field"]["unlimited"] is False
    assert "storage_gb" not in meters

    storage = storage_meter(plan_key="solo", used_bytes=0)
    assert storage["key"] == "storage_gb"
    assert storage["unit"] == "bytes"
    assert storage["current"] == 0
    assert storage["limit"] == 15 * (1024**3)
    assert storage["unlimited"] is False
    assert storage["at_limit"] is False

    combined = {row["key"]: row for row in workspace_meters(plan_key="solo", occupied_roles=["owner"], used_bytes=1024)}
    assert combined["storage_gb"]["current"] == 1024
    assert combined["seats_operator"]["limit"] == 1
    assert combined["quota_quotes"]["current"] == 0
    assert combined["quota_quotes"]["limit"] == 50
    assert combined["quota_clients"]["current"] == 0
    assert combined["quota_clients"]["limit"] == 30


def test_quota_meters_unlimited_on_enterprise():
    from app.authz.catalog import load_catalog
    from app.authz.usage import workspace_meters

    load_catalog.cache_clear()
    meters = {row["key"]: row for row in workspace_meters(plan_key="enterprise", quotes_count=500, customers_count=300)}
    assert meters["quota_quotes"]["unlimited"] is True
    assert meters["quota_quotes"]["at_limit"] is False
    assert meters["quota_clients"]["unlimited"] is True
    assert meters["quota_clients"]["at_limit"] is False


def test_quota_meters_at_limit():
    from app.authz.catalog import load_catalog
    from app.authz.usage import workspace_meters

    load_catalog.cache_clear()
    meters = {row["key"]: row for row in workspace_meters(plan_key="solo", quotes_count=50, customers_count=30)}
    assert meters["quota_quotes"]["at_limit"] is True
    assert meters["quota_clients"]["at_limit"] is True


def test_enterprise_storage_unlimited():
    from app.authz.catalog import load_catalog
    from app.authz.usage import storage_meter

    load_catalog.cache_clear()
    storage = storage_meter(plan_key="enterprise", used_bytes=10_000_000_000)
    assert storage["unlimited"] is True
    assert storage["limit"] == 0
    assert storage["at_limit"] is False

