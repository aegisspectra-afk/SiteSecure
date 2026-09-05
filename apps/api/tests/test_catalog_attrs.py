from app.catalog_attrs import (
    AttributeValidationError,
    attribute_schema_for_category,
    normalize_unit,
    parse_camera_technical_attrs,
    parse_hdd_technical_attrs,
    parse_nvr_technical_attrs,
    parse_switch_technical_attrs,
    technical_attrs_completeness,
    validate_product_attributes,
)


def test_normalize_unit_aliases():
    assert normalize_unit("ea") == "unit"
    assert normalize_unit("meter") == "m"
    assert normalize_unit("hour") == "hour"
    assert normalize_unit("weird") == "unit"


def test_attribute_schema_by_leaf_and_parent():
    camera = attribute_schema_for_category(category_key="cameras_ip")
    assert any(f["key"] == "resolution_mp" for f in camera)
    assert any(f["key"] == "max_power_w" for f in camera)
    switch = attribute_schema_for_category(category_key="unknown_leaf", parent_key="network")
    assert any(f["key"] == "ports" for f in switch)
    empty = attribute_schema_for_category(category_key="labor_install_cameras", parent_key="labor")
    assert empty == []


def test_hdd_uses_dedicated_schema_not_camera():
    hdd = attribute_schema_for_category(category_key="hdd_recorders", parent_key="video")
    keys = {f["key"] for f in hdd}
    assert "capacity_tb" in keys
    assert "surveillance_grade" in keys
    assert "resolution_mp" not in keys
    assert "channels" not in keys


def test_video_parent_no_longer_forces_camera_on_unknown_leaf():
    # Accessories under video must not inherit camera technical schema.
    empty = attribute_schema_for_category(category_key="camera_accessories", parent_key="video")
    assert empty == []


def test_camera_valid_and_invalid():
    ok = validate_product_attributes(
        {
            "resolution_mp": 4,
            "environment": "outdoor",
            "form_factor": "bullet",
            "poe": True,
            "max_power_w": 8.5,
            "onvif": None,
        },
        category_key="cameras_ip",
        parent_key="video",
    )
    assert ok["resolution_mp"] == 4.0
    assert "onvif" not in ok  # unknown omitted

    try:
        validate_product_attributes(
            {"resolution_mp": -1},
            category_key="cameras_ip",
            parent_key="video",
        )
        raise AssertionError("expected validation error")
    except AttributeValidationError as exc:
        assert "resolution_mp" in exc.field_errors


def test_nvr_negative_channels_rejected():
    try:
        validate_product_attributes(
            {"channels": -4},
            category_key="nvr",
            parent_key="video",
        )
        raise AssertionError("expected validation error")
    except AttributeValidationError as exc:
        assert "channels" in exc.field_errors


def test_nvr_valid():
    ok = validate_product_attributes(
        {
            "channels": 16,
            "poe_ports": 16,
            "poe_budget_w": 200,
            "drive_bays": 2,
            "max_hdd_tb": 10,
        },
        category_key="nvr",
        parent_key="video",
    )
    assert ok["channels"] == 16
    assert ok["drive_bays"] == 2


def test_hdd_capacity_validation():
    ok = validate_product_attributes(
        {"capacity_tb": 8, "surveillance_grade": True},
        category_key="hdd_recorders",
        parent_key="video",
    )
    assert ok["capacity_tb"] == 8.0
    try:
        validate_product_attributes(
            {"capacity_tb": "large"},
            category_key="hdd_recorders",
            parent_key="video",
        )
        raise AssertionError("expected validation error")
    except AttributeValidationError as exc:
        assert "capacity_tb" in exc.field_errors


def test_switch_poe_ports_cannot_exceed_ports():
    try:
        validate_product_attributes(
            {"ports": 8, "poe_ports": 16, "poe_budget_w": 120},
            category_key="switch_managed",
            parent_key="network",
        )
        raise AssertionError("expected validation error")
    except AttributeValidationError as exc:
        assert "poe_ports" in exc.field_errors


def test_switch_valid():
    ok = validate_product_attributes(
        {"ports": 16, "poe_ports": 16, "poe_budget_w": 180, "port_speed_mbps": 1000},
        category_key="switch",
        parent_key="network",
    )
    assert ok["ports"] == 16
    assert ok["poe_budget_w"] == 180.0


def test_missing_optional_attrs_accepted():
    assert validate_product_attributes({}, category_key="cameras_ip", parent_key="video") == {}
    assert validate_product_attributes({}, category_key="hdd_recorders", parent_key="video") == {}


def test_unknown_optional_boolean_preserved_as_absent():
    ok = validate_product_attributes(
        {"poe": "", "onvif": "unknown"},
        category_key="cameras_ip",
        parent_key="video",
    )
    assert "poe" not in ok
    assert "onvif" not in ok


def test_category_isolation_rejects_foreign_technical_keys():
    try:
        validate_product_attributes(
            {"capacity_tb": 8, "channels": 16},
            category_key="cameras_ip",
            parent_key="video",
        )
        raise AssertionError("expected validation error")
    except AttributeValidationError as exc:
        assert "capacity_tb" in exc.field_errors
        assert "channels" in exc.field_errors


def test_legacy_non_technical_keys_preserved():
    ok = validate_product_attributes(
        {"resolution": "4K", "custom_note": "keep"},
        category_key="cameras_ip",
        parent_key="video",
    )
    assert ok["resolution"] == "4K"
    assert ok["custom_note"] == "keep"


def test_typed_parsers():
    cam = parse_camera_technical_attrs({"resolution_mp": 4, "poe": True, "onvif": None})
    assert cam.resolution_mp == 4.0
    assert cam.poe is True
    assert cam.onvif is None

    nvr = parse_nvr_technical_attrs({"channels": 16, "hdd_bays": 2})
    assert nvr.channels == 16
    assert nvr.drive_bays == 2  # legacy alias

    hdd = parse_hdd_technical_attrs({"capacity_tb": 8})
    assert hdd.capacity_tb == 8.0
    assert hdd.surveillance_grade is None

    sw = parse_switch_technical_attrs({"ports": 16, "poe_ports": 8, "poe_budget": 100})
    assert sw.ports == 16
    assert sw.poe_budget_w == 100.0


def test_completeness_helper():
    incomplete = technical_attrs_completeness(
        category_key="cameras_ip",
        parent_key="video",
        attributes={},
    )
    assert incomplete["complete"] is False
    assert "resolution_mp" in incomplete["missing_keys"]

    complete = technical_attrs_completeness(
        category_key="hdd_recorders",
        parent_key="video",
        attributes={"capacity_tb": 8},
    )
    assert complete["complete"] is True
    assert complete["family"] == "hdd"
