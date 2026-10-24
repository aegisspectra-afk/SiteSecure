"""Short Edge probe: confirm 5176 talks to local Auth/API, not :8000 or supabase.co."""

from __future__ import annotations

from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

WEB = "http://127.0.0.1:5176"
hits: dict[str, int] = {}
cloud: list[str] = []
port_8000: list[str] = []


def classify(url: str) -> str:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    if "supabase.co" in host or "supabase.net" in host:
        return "cloud_supabase"
    if host in {"127.0.0.1", "localhost"} and port == 8000:
        return "cloud_api_8000"
    if host in {"127.0.0.1", "localhost"} and port == 5176:
        return "local_vite_5176"
    if host in {"127.0.0.1", "localhost"} and port == 8001:
        return "local_api_8001"
    if host in {"127.0.0.1", "localhost"} and port == 54321:
        return "local_auth_54321"
    return f"other:{host}:{port}"


def main() -> int:
    pw = sync_playwright().start()
    try:
        browser = pw.chromium.launch(channel="msedge", headless=True)
        print("BROWSER channel=msedge", flush=True)
    except Exception as exc:  # noqa: BLE001
        pw.stop()
        print(f"EDGE_PROBE fail launch {type(exc).__name__}", flush=True)
        return 2
    page = browser.new_page()

    def on_req(req) -> None:
        kind = classify(req.url)
        hits[kind] = hits.get(kind, 0) + 1
        if kind == "cloud_supabase":
            cloud.append(req.url.split("?")[0])
        if kind == "cloud_api_8000":
            port_8000.append(req.url.split("?")[0])

    page.on("request", on_req)
    page.goto(f"{WEB}/login", wait_until="networkidle")
    browser.close()
    pw.stop()
    print("EDGE_HITS " + " ".join(f"{k}={v}" for k, v in sorted(hits.items())), flush=True)
    print(f"EDGE_CLOUD_SUPABASE {len(cloud)} EDGE_PORT_8000 {len(port_8000)}", flush=True)
    if cloud or port_8000:
        return 1
    if hits.get("local_vite_5176", 0) < 1:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
