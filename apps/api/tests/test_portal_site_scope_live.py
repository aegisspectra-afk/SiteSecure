"""Live: portal site-scoped grant must not leak other sites."""

from __future__ import annotations

import uuid
from urllib.parse import urlparse

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from app.portal_otp import hash_portal_session_token, mint_portal_session_token, normalize_portal_phone
from tests.test_d1_dashboard_live import _svc_insert

pytestmark = pytest.mark.live


@pytest.fixture(scope="module")
def settings():
    get_settings.cache_clear()
    s = get_settings()
    assert urlparse(s.supabase_url).hostname in {"127.0.0.1", "localhost"}, "local Supabase only"
    return s


def test_portal_site_scope_home_isolation(settings):
    """Contact limited to site A must not see site B in portal home."""
    key = getattr(settings, "supabase_service_role_key", None) or ""
    if not key or key.startswith("test-"):
        pytest.skip("local SUPABASE_SERVICE_ROLE_KEY required")
    suffix = uuid.uuid4().hex[:8]
    phone = f"050{suffix[:7]}".ljust(10, "0")[:10]
    workspace_id = _svc_insert(settings, "workspaces", {"name": f"PortalScope {suffix}", "status": "active"})["id"]
    customer_id = _svc_insert(
        settings,
        "customers",
        {"workspace_id": workspace_id, "display_name": "לקוח בדיקה", "type": "private", "phone": phone},
    )["id"]
    site_a_id = _svc_insert(
        settings, "sites", {"workspace_id": workspace_id, "customer_id": customer_id, "name": "אתר א", "code": suffix}
    )["id"]
    _svc_insert(settings, "sites", {"workspace_id": workspace_id, "customer_id": customer_id, "name": "אתר ב", "code": suffix + "b"})
    access_id = _svc_insert(
        settings,
        "customer_portal_access",
        {
            "workspace_id": workspace_id,
            "customer_id": customer_id,
            "email": f"portal.{suffix}@sitesecure.test",
            "status": "active",
            "scope": "sites",
            "capabilities": ["portal.sites.view", "portal.service.view"],
        },
    )["id"]
    _svc_insert(settings, "customer_portal_site_grants", {"access_id": access_id, "site_id": site_a_id})
    token = mint_portal_session_token()
    session_id = _svc_insert(
        settings,
        "portal_sessions",
        {
            "token_hash": hash_portal_session_token(token),
            "phone_normalized": normalize_portal_phone(phone),
            "expires_at": "2099-01-01T00:00:00+00:00",
        },
    )["id"]
    _svc_insert(settings, "portal_session_grants", {"session_id": session_id, "access_id": access_id})

    api = TestClient(app)
    home = api.get(
        f"/api/v1/portal/access/{access_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert home.status_code == 200, home.text
    body = home.json()
    site_names = {s["name"] for s in body.get("sites") or []}
    assert "אתר א" in site_names
    assert "אתר ב" not in site_names