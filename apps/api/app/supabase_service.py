from __future__ import annotations

import httpx

from .config import Settings
from .errors import ApiError


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

    def get(self, path: str, params: dict | None = None) -> httpx.Response:
        with httpx.Client(timeout=20.0) as client:
            return client.get(f"{self.rest}/{path.lstrip('/')}", headers=self._headers, params=params)

    def post(self, path: str, json: dict | list | None = None, params: dict | None = None) -> httpx.Response:
        with httpx.Client(timeout=20.0) as client:
            return client.post(
                f"{self.rest}/{path.lstrip('/')}",
                headers=self._headers,
                json=json,
                params=params,
            )

    def patch(self, path: str, json: dict, params: dict | None = None, *, prefer: str | None = None) -> httpx.Response:
        headers = dict(self._headers)
        if prefer:
            headers["Prefer"] = prefer
        with httpx.Client(timeout=20.0) as client:
            return client.patch(
                f"{self.rest}/{path.lstrip('/')}",
                headers=headers,
                json=json,
                params=params,
            )
