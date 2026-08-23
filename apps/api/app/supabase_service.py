from __future__ import annotations

from .config import Settings
from .errors import ApiError
from .http_supabase import supabase_request


class ServiceClient:
    """PostgREST with the service role. Used after authorize() and for public quote access."""

    def __init__(self, settings: Settings) -> None:
        key = settings.supabase_service_role_key
        if not key:
            raise ApiError(503, "API_UNAVAILABLE", "שירות הגישה הציבורית אינו זמין")
        self._settings = settings
        self._headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    @property
    def rest(self) -> str:
        return f"{self._settings.supabase_url}/rest/v1"

    def get(self, path: str, params: dict | None = None):
        return supabase_request(
            "GET",
            f"{self.rest}/{path.lstrip('/')}",
            headers=self._headers,
            params=params,
        )

    def post(self, path: str, json: dict | list | None = None, params: dict | None = None):
        return supabase_request(
            "POST",
            f"{self.rest}/{path.lstrip('/')}",
            headers=self._headers,
            params=params,
            json=json,
        )

    def patch(self, path: str, json: dict, params: dict | None = None, *, prefer: str | None = None):
        headers = dict(self._headers)
        if prefer:
            headers["Prefer"] = prefer
        return supabase_request(
            "PATCH",
            f"{self.rest}/{path.lstrip('/')}",
            headers=headers,
            params=params,
            json=json,
        )
