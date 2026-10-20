"""B2.1a: current_user archive gate fails closed when status is unverifiable."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.deps import current_user
from app.errors import ApiError


def _client(*, get_side_effect=None, get_return=None) -> MagicMock:
    client = MagicMock()
    client.get_user.return_value = {"id": "u1", "email": "a@b.com"}
    if get_side_effect is not None:
        client.get.side_effect = get_side_effect
    else:
        client.get.return_value = get_return
    return client


def test_current_user_allows_active_profile():
    client = _client(
        get_return=SimpleNamespace(status_code=200, json=lambda: [{"archived_at": None}]),
    )
    user = current_user(client)
    assert user["id"] == "u1"


def test_current_user_rejects_archived_profile():
    client = _client(
        get_return=SimpleNamespace(
            status_code=200,
            json=lambda: [{"archived_at": "2026-01-01T00:00:00Z"}],
        ),
    )
    with pytest.raises(ApiError) as exc:
        current_user(client)
    assert exc.value.status_code == 403
    assert exc.value.code == "ACCOUNT_INACTIVE"


def test_current_user_fails_closed_on_transport_error():
    client = _client(get_side_effect=RuntimeError("network"))
    with pytest.raises(ApiError) as exc:
        current_user(client)
    assert exc.value.status_code == 503
    assert exc.value.code == "API_UNAVAILABLE"


def test_current_user_fails_closed_on_non_200():
    client = _client(get_return=SimpleNamespace(status_code=500, json=lambda: []))
    with pytest.raises(ApiError) as exc:
        current_user(client)
    assert exc.value.status_code == 503
    assert exc.value.code == "API_UNAVAILABLE"


def test_current_user_fails_closed_on_empty_profile_row():
    client = _client(get_return=SimpleNamespace(status_code=200, json=lambda: []))
    with pytest.raises(ApiError) as exc:
        current_user(client)
    assert exc.value.status_code == 503
    assert exc.value.code == "API_UNAVAILABLE"
