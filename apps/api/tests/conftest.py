from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
from dotenv import load_dotenv

API_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(API_ROOT))

load_dotenv(REPO_ROOT / ".env")
load_dotenv(API_ROOT / ".env")

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")


@pytest.fixture(autouse=True)
def _c5_fail_closed_before_client(request):
    """C5 live/local-marked tests must use isolated loopback env. No cloud fallback."""
    if request.node.get_closest_marker("c5_write") or request.node.get_closest_marker("c5_local"):
        from tests.ssp_c5_local import require_c5_local_process_env

        require_c5_local_process_env()
