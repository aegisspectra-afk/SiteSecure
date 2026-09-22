import httpx
from pathlib import Path

API = "http://127.0.0.1:8000"
token = Path("scripts/.tmp_import_token").read_text(encoding="utf-8").strip()
h = {"Authorization": f"Bearer {token}"}
ws = httpx.get(f"{API}/api/v1/auth/session", headers=h).json()["memberships"][0]["workspace_id"]

with httpx.Client(timeout=60) as c:
    inc = c.post(f"{API}/api/v1/workspaces/{ws}/quotes", headers=h, json={"title": "Incomplete QA"}).json()
    print("inc id", inc["id"])
    print("validation", inc.get("validation"))
    full = c.get(f"{API}/api/v1/workspaces/{ws}/quotes/{inc['id']}", headers=h).json()
    print("full validation", full.get("validation"))
