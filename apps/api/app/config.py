import base64
import json
import os
from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[3]


def parse_cors_origins(web_public_url: str, extra: str = "", app_env: str = "development") -> list[str]:
    """Browser origins allowed to call the API. Never '*'."""
    seen: list[str] = []

    def add(raw: str) -> None:
        url = raw.strip().rstrip("/")
        if url and url not in seen:
            seen.append(url)

    add(web_public_url)
    for part in extra.split(","):
        add(part)
    env = app_env.strip().lower()
    web = web_public_url.strip().rstrip("/")
    if env in {"development", "dev", "test"} or web.startswith("http://localhost"):
        add("http://localhost:5173")
        add("http://localhost:8081")
    return seen


def _jwt_role(token: str) -> str | None:
    try:
        payload = token.split(".")[1]
        pad = "=" * (-len(payload) % 4)
        data = json.loads(base64.urlsafe_b64decode(payload + pad))
        return data.get("role")
    except Exception:
        return None


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(ROOT / ".env", Path(__file__).resolve().parents[1] / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    supabase_url: str = Field(alias="SUPABASE_URL")
    supabase_anon_key: str = Field(alias="SUPABASE_ANON_KEY")
    supabase_service_role_key: str | None = Field(default=None, alias="SUPABASE_SERVICE_ROLE_KEY")
    api_public_url: str = Field(default="http://localhost:8000", alias="API_PUBLIC_URL")
    web_public_url: str = Field(default="http://localhost:5173", alias="WEB_PUBLIC_URL")
    cors_extra_origins: str = Field(default="", alias="CORS_EXTRA_ORIGINS")
    app_env: str = Field(default="development", alias="APP_ENV")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    @field_validator("supabase_url")
    @classmethod
    def strip_rest_suffix(cls, value: str) -> str:
        url = value.rstrip("/")
        if url.endswith("/rest/v1"):
            url = url[: -len("/rest/v1")]
        return url

    @field_validator("supabase_service_role_key")
    @classmethod
    def reject_non_service_role(cls, value: str | None) -> str | None:
        if not value:
            return None
        if value.startswith("sb_publishable_"):
            return None
        if value.startswith("sb_secret_"):
            return value
        role = _jwt_role(value)
        if role in {None, "anon", "authenticated"}:
            return None
        if role != "service_role":
            return None
        return value

    @property
    def catalog_path(self) -> Path:
        env = os.environ.get("AUTHZ_CATALOG_PATH")
        if env:
            return Path(env)
        return ROOT / "packages" / "authz" / "catalog.json"

    def cors_allow_origins(self) -> list[str]:
        return parse_cors_origins(self.web_public_url, self.cors_extra_origins, self.app_env)


@lru_cache
def get_settings() -> Settings:
    return Settings()
