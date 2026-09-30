"""SETTINGS-3B — site requirement flags (server enforcement)."""

import pytest

from app.errors import ApiError
from app.site_requirements import address_has_content, enforce_site_requirements


def test_address_has_content_keys():
    assert address_has_content({"city": "תל אביב"}) is True
    assert address_has_content({"line": "  "}) is False
    assert address_has_content({}) is False
    assert address_has_content(None) is False


def test_enforce_address_required():
    with pytest.raises(ApiError) as exc:
        enforce_site_requirements(
            flags={"require_address": True, "require_access_notes": False},
            address={},
            access_notes=None,
        )
    assert exc.value.status_code == 400
    assert "כתובת" in str(exc.value.message)


def test_enforce_access_notes_required():
    with pytest.raises(ApiError) as exc:
        enforce_site_requirements(
            flags={"require_address": False, "require_access_notes": True},
            address={"city": "חיפה"},
            access_notes="  ",
        )
    assert exc.value.status_code == 400
    assert "גישה" in str(exc.value.message)


def test_enforce_passes_when_satisfied():
    enforce_site_requirements(
        flags={"require_address": True, "require_access_notes": True},
        address={"line": "רחוב 1"},
        access_notes="קוד 123",
    )


def test_enforce_noop_when_flags_false():
    enforce_site_requirements(
        flags={"require_address": False, "require_access_notes": False},
        address={},
        access_notes=None,
    )
