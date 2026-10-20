"""C5 isolated local-Supabase target. Fail closed before any client or SQL write.

Does not read cloud .env for C5 keys. Does not print secrets.
"""

from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import urlparse

C5_REQUIRED_KEYS = (
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
)

API_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = Path(__file__).resolve().parents[3]
C5_ENV_CANDIDATES = (
    REPO_ROOT / ".env.c5.local",
    API_ROOT / ".env.c5.local",
)

DEV_ENV_FILES = (
    REPO_ROOT / ".env",
    API_ROOT / ".env",
)


class C5RemoteTargetError(RuntimeError):
    """Raised when C5 would talk to a non-loopback or hosted Supabase project."""


def classify_supabase_host(host: str | None) -> str:
    h = (host or "").lower()
    if h in {"localhost", "127.0.0.1", "::1"} or h.endswith(".local"):
        return "local"
    if h.endswith(".supabase.co") or h.endswith(".supabase.net"):
        return "supabase_cloud"
    if not h:
        return "empty"
    return "other"


def parse_env_file(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.is_file():
        return out
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        out[key.strip()] = value.strip().strip('"').strip("'")
    return out


def host_class_from_url(url: str | None) -> tuple[str, str]:
    host = urlparse((url or "").strip()).hostname or ""
    return host, classify_supabase_host(host)


def assert_local_supabase_url(url: str | None) -> str:
    """Refuse anything that is not the local config.toml API (loopback:54321)."""
    raw = (url or "").strip()
    parsed = urlparse(raw)
    host = (parsed.hostname or "").lower()
    kind = classify_supabase_host(host)
    lowered = raw.lower()
    if "supabase.co" in lowered or "supabase.net" in lowered:
        raise C5RemoteTargetError("C5 refused hosted Supabase URL (*.supabase.co / *.supabase.net)")
    if kind != "local":
        raise C5RemoteTargetError(f"C5 refused non-local Supabase host class={kind!r}")
    if parsed.scheme not in {"http", "https"}:
        raise C5RemoteTargetError("C5 refused Supabase URL with missing http(s) scheme")
    if parsed.port != 54321:
        raise C5RemoteTargetError("C5 refused Supabase URL that is not loopback port 54321")
    return host


def c5_env_path() -> Path | None:
    for path in C5_ENV_CANDIDATES:
        if path.is_file():
            return path
    return None


def apply_c5_local_env() -> Path:
    """Load isolated C5 keys only. Overrides process env. Does not edit dev .env files."""
    path = c5_env_path()
    if path is None:
        raise C5RemoteTargetError(
            "C5 isolated env missing. Create .env.c5.local from `supabase status` "
            "(http://127.0.0.1:54321). Do not copy cloud keys."
        )
    values = parse_env_file(path)
    for key in C5_REQUIRED_KEYS:
        value = values.get(key, "").strip()
        if not value:
            raise C5RemoteTargetError(f"C5 isolated env missing {key}")
        os.environ[key] = value
    assert_local_supabase_url(os.environ["SUPABASE_URL"])
    try:
        from app.config import get_settings

        get_settings.cache_clear()
    except Exception:
        pass
    return path


def require_c5_local_process_env() -> str:
    """Call before creating a client or issuing SQL. Fail closed. No skip, no mock."""
    apply_c5_local_env()
    return assert_local_supabase_url(os.environ.get("SUPABASE_URL"))
