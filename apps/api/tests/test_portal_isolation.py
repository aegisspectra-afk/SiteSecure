"""Portal grant isolation — session bearer cannot cross customers."""

from uuid import UUID

import pytest

from app.errors import ApiError
from app.portal_session_auth import PortalAuth, require_portal_grant


class _StubService:
    def get(self, *_args, **_kwargs):
        raise AssertionError("service should not be called when access_id is out of scope")


def test_portal_session_rejects_foreign_access_id():
    auth = PortalAuth(
        mode="session",
        user_id=None,
        session_id="sess-1",
        access_ids=frozenset(["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"]),
    )
    foreign = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
    with pytest.raises(ApiError) as exc:
        require_portal_grant(_StubService(), auth, foreign)
    assert exc.value.status_code == 404