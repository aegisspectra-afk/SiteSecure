from app.authz.limits import evaluate_seat_limit


def test_solo_field_seat_allows_first_technician():
    d = evaluate_seat_limit(plan_key="solo", invite_role="technician", occupied_roles=["owner"])
    assert d.allowed is True


def test_solo_field_seat_blocks_at_catalog_cap():
    d = evaluate_seat_limit(
        plan_key="solo",
        invite_role="technician",
        occupied_roles=["owner", "technician", "founding_technician", "viewer"],
    )
    assert d.allowed is False
    assert d.code == "PLAN_LIMIT_REACHED"
    assert d.details["limit"] == 3
    assert d.details["limit_key"] == "seats_field"


def test_solo_operator_seat_is_full_with_owner():
    d = evaluate_seat_limit(plan_key="solo", invite_role="sales", occupied_roles=["owner"])
    assert d.allowed is False
    assert d.code == "PLAN_LIMIT_REACHED"
    assert d.details["limit_key"] == "seats_operator"


def test_enterprise_zero_means_unlimited():
    d = evaluate_seat_limit(
        plan_key="enterprise",
        invite_role="technician",
        occupied_roles=["owner"] + ["technician"] * 50,
    )
    assert d.allowed is True


def test_seat_meters_read_catalog_not_hardcoded_fives():
    from app.authz.usage import seat_meters

    meters = {row["key"]: row for row in seat_meters(plan_key="solo", occupied_roles=["owner"])}
    assert meters["seats_operator"]["current"] == 1
    assert meters["seats_operator"]["limit"] == 1
    assert meters["seats_operator"]["at_limit"] is True
    assert meters["seats_field"]["current"] == 0
    assert meters["seats_field"]["limit"] == 3
    assert meters["seats_field"]["unlimited"] is False
    assert "storage" not in meters

