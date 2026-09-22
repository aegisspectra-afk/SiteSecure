from __future__ import annotations

from pathlib import Path

import httpx

API = "http://127.0.0.1:8000"
WS = "f1f76d59-fd2e-4b27-9586-06f7c89abc9c"
Q = "9d2f1103-7c02-437a-af9e-f680bc8f8b32"
token = Path(__file__).with_name(".tmp_import_token").read_text(encoding="utf-8").strip()
h = {"Authorization": f"Bearer {token}"}
out = Path(__file__).resolve().parents[1] / "_q00012_rebuilt.pdf"

with httpx.Client(timeout=90) as c:
    r = c.get(f"{API}/api/v1/workspaces/{WS}/quotes/{Q}/pdf", headers=h)
    print("status", r.status_code, r.headers.get("content-disposition"))
    assert r.status_code == 200, r.text[:300]
    assert r.content[:4] == b"%PDF"
    out.write_bytes(r.content)
    print("wrote", out, "bytes", len(r.content))

    banned = (b"cost_total", b"margin_percent", b"internal_notes", b"gross_profit")
    for b in banned:
        assert b not in r.content, b

print("OK")
