from __future__ import annotations

import httpx

api = httpx.get("http://127.0.0.1:8001/health", timeout=10)
print("api_health", api.status_code, api.text[:120])
web = httpx.get("http://127.0.0.1:5176/login", timeout=20)
print("web_login", web.status_code, "len", len(web.text))
print("html_has_cloud", "supabase.co" in web.text)
print("html_has_local", "127.0.0.1:54321" in web.text)
print("html_has_error", "LoadingBlock" in web.text and "No matching export" in web.text)
print("html_snip", web.text[:300].replace("\n", " "))
