"""Start isolated Vite against Local Supabase Auth + local API proxy. Does not edit cloud .env."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

API_ROOT = Path(__file__).resolve().parents[1]
REPO = API_ROOT.parents[1]
WEB = REPO / "apps" / "web"
sys.path.insert(0, str(API_ROOT))

from tests.ssp_c5_local import C5RemoteTargetError, parse_env_file, require_c5_local_process_env

require_c5_local_process_env()
c5 = parse_env_file(REPO / ".env.c5.local")
url = c5["SUPABASE_URL"].strip()
anon = c5["SUPABASE_ANON_KEY"].strip()
parsed = urlparse(url)
if parsed.hostname not in {"127.0.0.1", "localhost"} or parsed.port != 54321:
    raise C5RemoteTargetError("web launcher refused non-local supabase")
if "supabase.co" in url.lower():
    raise C5RemoteTargetError("web launcher refused cloud supabase")

env = os.environ.copy()
env["VITE_SUPABASE_URL"] = url
env["VITE_SUPABASE_ANON_KEY"] = anon
env["VITE_API_URL"] = "http://127.0.0.1:8001"
print(f"C5_WEB_TARGET host={parsed.hostname} port={parsed.port} api=http://127.0.0.1:8001 vite=5173", flush=True)

vite = REPO / "node_modules" / "vite" / "bin" / "vite.js"
node = "node"
# Bind all local interfaces so http://localhost:5173 and http://127.0.0.1:5173 both work.
args = [node, str(vite), "--host", "0.0.0.0", "--port", "5173", "--strictPort"]
raise SystemExit(subprocess.call(args, cwd=str(WEB), env=env))
