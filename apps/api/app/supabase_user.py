from __future__ import annotations

from .config import Settings
from .errors import ApiError
from .http_supabase import supabase_request


class UserClient:
    """PostgREST + Auth + Storage using the caller's JWT so RLS sees auth.uid()."""

    def __init__(self, settings: Settings, access_token: str) -> None:
        if settings.supabase_service_role_key and access_token == settings.supabase_service_role_key:
            raise ApiError(401, "UNAUTHENTICATED", "נדרשת התחברות")
        self._settings = settings
        self._token = access_token
        self._headers = {
            "apikey": settings.supabase_anon_key,
            "Authorization": f"Bearer {access_token}",
        }

    @property
    def rest(self) -> str:
        return f"{self._settings.supabase_url}/rest/v1"

    @property
    def auth(self) -> str:
        return f"{self._settings.supabase_url}/auth/v1"

    @property
    def storage(self) -> str:
        return f"{self._settings.supabase_url}/storage/v1"

    def _rest_headers(self, prefer: str | None = None) -> dict[str, str]:
        return {
            **self._headers,
            "Content-Type": "application/json",
            "Prefer": prefer or "return=representation",
        }

    def get_user(self) -> dict:
        response = supabase_request("GET", f"{self.auth}/user", headers=self._headers)
        if response.status_code != 200:
            raise ApiError(401, "UNAUTHENTICATED", "נדרשת התחברות")
        return response.json()

    def get(self, path: str, params: dict | None = None):
        return supabase_request(
            "GET",
            f"{self.rest}/{path.lstrip('/')}",
            headers=self._rest_headers(),
            params=params,
        )

    def post(self, path: str, json: dict | list | None = None, params: dict | None = None):
        return supabase_request(
            "POST",
            f"{self.rest}/{path.lstrip('/')}",
            headers=self._rest_headers(),
            params=params,
            json=json,
        )

    def patch(self, path: str, json: dict, params: dict | None = None, *, prefer: str | None = None):
        return supabase_request(
            "PATCH",
            f"{self.rest}/{path.lstrip('/')}",
            headers=self._rest_headers(prefer),
            params=params,
            json=json,
        )

    def delete(self, path: str, params: dict | None = None):
        return supabase_request(
            "DELETE",
            f"{self.rest}/{path.lstrip('/')}",
            headers=self._rest_headers(),
            params=params,
        )

    def rpc(self, name: str, payload: dict):
        return supabase_request(
            "POST",
            f"{self.rest}/rpc/{name}",
            headers=self._rest_headers(),
            json=payload,
        )

    def storage_sign_upload(self, bucket: str, path: str) -> dict:
        response = supabase_request(
            "POST",
            f"{self.storage}/object/upload/sign/{bucket}/{path}",
            headers=self._rest_headers(),
            json={},
        )
        if response.status_code not in {200, 201}:
            raise ApiError(403, "PERMISSION_DENIED", "לא ניתן ליצור כתובת העלאה")
        data = response.json()
        token = data.get("token")
        relative = data.get("url") or f"/object/upload/sign/{bucket}/{path}"
        if token and "token=" not in relative:
            relative = f"{relative}{'&' if '?' in relative else '?'}token={token}"
        upload_url = relative if relative.startswith("http") else f"{self.storage}{relative}"
        return {"upload_url": upload_url, "token": token, "path": data.get("path") or path}

    def storage_sign_download(self, bucket: str, path: str, expires_in: int = 60) -> str:
        response = supabase_request(
            "POST",
            f"{self.storage}/object/sign/{bucket}/{path}",
            headers=self._rest_headers(),
            json={"expiresIn": expires_in},
        )
        if response.status_code != 200:
            raise ApiError(404, "NOT_FOUND", "לא נמצא")
        data = response.json()
        signed = data.get("signedURL") or data.get("signedUrl") or data.get("url")
        if not signed:
            raise ApiError(404, "NOT_FOUND", "לא נמצא")
        if signed.startswith("http"):
            return signed
        return f"{self.storage}{signed}"
