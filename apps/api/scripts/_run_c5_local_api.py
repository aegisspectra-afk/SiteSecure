"""Start isolated FastAPI against Local Supabase only. Does not edit cloud .env."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import urlparse

API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))
os.chdir(API_ROOT)

from tests.ssp_c5_local import C5RemoteTargetError, assert_local_supabase_url, require_c5_local_process_env

host = require_c5_local_process_env()
url = os.environ["SUPABASE_URL"]
assert_local_supabase_url(url)
if "supabase.co" in url.lower() or "supabase.net" in url.lower():
    raise C5RemoteTargetError("refused cloud supabase")
parsed = urlparse(url)
print(f"C5_API_TARGET host={parsed.hostname} port={parsed.port} class=local", flush=True)

os.environ["API_PUBLIC_URL"] = "http://127.0.0.1:8001"
os.environ["WEB_PUBLIC_URL"] = "http://localhost:5173"
os.environ["CORS_EXTRA_ORIGINS"] = "http://localhost:5173,http://127.0.0.1:5173"
os.environ["APP_ENV"] = "development"

from app.config import get_settings

get_settings.cache_clear()
settings = get_settings()
parsed2 = urlparse(settings.supabase_url)
if parsed2.hostname not in {"127.0.0.1", "localhost"} or parsed2.port != 54321:
    raise C5RemoteTargetError(f"settings still not local host={parsed2.hostname} port={parsed2.port}")
print(f"C5_API_SETTINGS host={parsed2.hostname} port={parsed2.port}", flush=True)

import uvicorn

uvicorn.run("app.main:app", host="127.0.0.1", port=8001, reload=False)
