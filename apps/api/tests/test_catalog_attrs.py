from app.catalog_attrs import attribute_schema_for_category, normalize_unit


def test_normalize_unit_aliases():
    assert normalize_unit("ea") == "unit"
    assert normalize_unit("meter") == "m"
    assert normalize_unit("hour") == "hour"
    assert normalize_unit("weird") == "unit"


def test_attribute_schema_by_leaf_and_parent():
    camera = attribute_schema_for_category(category_key="cameras_ip")
    assert any(f["key"] == "resolution" for f in camera)
    switch = attribute_schema_for_category(category_key="unknown_leaf", parent_key="network")
    assert any(f["key"] == "ports" for f in switch)
    empty = attribute_schema_for_category(category_key="labor_install_cameras", parent_key="labor")
    assert empty == []
