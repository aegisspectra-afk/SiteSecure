from __future__ import annotations

import httpx

from .config import Settings
from .errors import ApiError, MESSAGES
from .http_supabase import DEFAULT_TIMEOUT, supabase_request


class ServiceClient:
    """PostgREST with the service role. Used after authorize() and for public quote access."""

    def __init__(self, settings: Settings) -> None:
        key = settings.supabase_service_role_key
        if not key:
            raise ApiError(503, "API_UNAVAILABLE", "שירות הגישה הציבורית אינו זמין")
        self._settings = settings
        self._key = key
        self._headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    @property
    def rest(self) -> str:
        return f"{self._settings.supabase_url}/rest/v1"

    @property
    def storage(self) -> str:
        return f"{self._settings.supabase_url}/storage/v1"

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

    def storage_upload_bytes(self, bucket: str, path: str, data: bytes, content_type: str) -> None:
        """Upload a private object with the service role (bypasses Storage RLS)."""
        headers = {
            "apikey": self._key,
            "Authorization": f"Bearer {self._key}",
            "Content-Type": content_type,
            "x-upsert": "true",
        }
        url = f"{self.storage}/object/{bucket}/{path.lstrip('/')}"
        try:
            with httpx.Client(timeout=max(DEFAULT_TIMEOUT, 30.0)) as client:
                response = client.post(url, headers=headers, content=data)
        except (httpx.TimeoutException, httpx.TransportError) as exc:
            raise ApiError(503, "API_UNAVAILABLE", MESSAGES["API_UNAVAILABLE"]) from exc
        if response.status_code not in {200, 201}:
            raise ApiError(503, "API_UNAVAILABLE", "לא ניתן לשמור את החתימה")
