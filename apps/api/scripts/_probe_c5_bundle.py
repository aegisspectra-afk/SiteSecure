from __future__ import annotations

import httpx

client = httpx.Client(timeout=30)
mod = client.get("http://127.0.0.1:5176/src/lib/supabase.ts")
print("supabase_ts", mod.status_code, "cloud", "supabase.co" in mod.text, "local", "127.0.0.1:54321" in mod.text)
print("snip", mod.text[:400].replace("\n", " "))
rep = client.get("http://127.0.0.1:5176/src/routes/app/ssp/reports.tsx")
print("reports", rep.status_code, "err", "No matching export" in rep.text, "LoadingBlock" in rep.text[:200])
api_proxy = client.get("http://127.0.0.1:5176/api/v1/health")
print("proxy_health", api_proxy.status_code, api_proxy.text[:120])
