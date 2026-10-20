"""C5 local-target gate.

Read/config only in C5.3. Does not write. Does not call Cloud/Staging/Production.
Write / RLS / race / E2E proofs stay deferred until a later C5 step.
"""

from __future__ import annotations

from pathlib import Path
from urllib.parse import urlparse

import httpx
import pytest

from tests.ssp_c5_local import (
    C5RemoteTargetError,
    DEV_ENV_FILES,
    assert_local_supabase_url,
    classify_supabase_host,
    host_class_from_url,
    parse_env_file,
    require_c5_local_process_env,
)

ROOT = Path(__file__).resolve().parents[3]
CONFIG = ROOT / "supabase" / "config.toml"
ACT = ROOT / "supabase" / "migrations" / "20261020140000_ssp_site_activation.sql"
JOIN = ROOT / "supabase" / "migrations" / "20261020160000_ssp_site_user_join.sql"
SITES = ROOT / "supabase" / "migrations" / "20261020120000_ssp_sites_and_form_assignments.sql"
FORMS = ROOT / "supabase" / "migrations" / "20261019140000_ssp_digital_forms_v1.sql"
ORG = ROOT / "supabase" / "migrations" / "20261019220000_ssp_organization_core.sql"

_SSP_CHAIN = (
    FORMS.name,
    "20261019160000_ssp_forms_hardening.sql",
    ORG.name,
    "20261019230000_ssp_operations_core.sql",
    "20261019240000_ssp_ops_workflow_c2.sql",
    SITES.name,
    ACT.name,
    JOIN.name,
)


def test_c5_config_toml_declares_local_ports():
    text = CONFIG.read_text(encoding="utf-8")
    assert 'project_id = "site-secure-v2"' in text
    assert "port = 54321" in text
    assert "port = 54322" in text
    assert "port = 54323" in text


def test_c5_ssp_migration_files_exist_in_lex_order():
    names = sorted(p.name for p in (ROOT / "supabase" / "migrations").glob("[0-9]*.sql"))
    positions = [names.index(n) for n in _SSP_CHAIN]
    assert positions == sorted(positions)
    assert names[-1] == JOIN.name


def test_c5_guard_rejects_hosted_and_fallback_urls():
    for url in (
        "https://example.supabase.co",
        "https://abcdxyz.supabase.co",
        "https://proj.supabase.net",
        "http://localhost:8000",
        "http://127.0.0.1:54322",
        "",
    ):
        with pytest.raises(C5RemoteTargetError):
            assert_local_supabase_url(url)


def test_c5_guard_accepts_loopback_api_port():
    assert assert_local_supabase_url("http://127.0.0.1:54321") == "127.0.0.1"
    assert assert_local_supabase_url("http://localhost:54321") == "localhost"


def test_c5_dev_env_files_are_not_used_as_c5_target():
    """Dev .env may still point at cloud. C5 must not treat those files as the test target."""
    seen = False
    for path in DEV_ENV_FILES:
        values = parse_env_file(path)
        url = values.get("SUPABASE_URL")
        if not url:
            continue
        seen = True
        _host, kind = host_class_from_url(url)
        if kind == "local":
            parsed = urlparse(url)
            assert parsed.port == 54321
        else:
            assert kind == "supabase_cloud"
            with pytest.raises(C5RemoteTargetError):
                assert_local_supabase_url(url)
    assert seen, "expected at least one dev .env SUPABASE_URL to classify"


@pytest.mark.c5_local
def test_c5_isolated_process_env_is_loopback_before_any_client():
    host = require_c5_local_process_env()
    from app.config import get_settings

    settings = get_settings()
    parsed = urlparse(settings.supabase_url)
    assert parsed.hostname == host
    assert classify_supabase_host(parsed.hostname) == "local"
    assert parsed.port == 54321
    assert "supabase.co" not in settings.supabase_url.lower()


@pytest.mark.c5_local
def test_c5_local_auth_health_read_only():
    require_c5_local_process_env()
    from app.config import get_settings

    settings = get_settings()
    assert_local_supabase_url(settings.supabase_url)
    response = httpx.get(
        f"{settings.supabase_url.rstrip('/')}/auth/v1/health",
        headers={"apikey": settings.supabase_anon_key},
        timeout=8,
    )
    assert response.status_code == 200
    body = response.json()
    assert body.get("name") == "GoTrue"


@pytest.mark.c5_write
@pytest.mark.skip(reason="Live RLS/write proofs require applied 20160000 plus isolated local JWT fixtures")
def test_c5_live_rls_authenticated_cannot_insert_device_session():
    raise AssertionError("not an integration proof")


@pytest.mark.c5_write
@pytest.mark.skip(reason="Live race proofs require applied 20160000 plus isolated local JWT fixtures")
def test_c5_live_race_consume_approve_claim_submit():
    raise AssertionError("not an integration proof")


@pytest.mark.c5_write
@pytest.mark.skip(reason="Browser/API E2E writes blocked until API+web process env is loopback:54321")
def test_c5_live_e2e_issue_activate_approve_claim_submit_revoke():
    raise AssertionError("not an integration proof")
