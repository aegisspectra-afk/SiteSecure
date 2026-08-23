import httpx
import pytest

from app.errors import ApiError
from app.http_supabase import supabase_request


def test_supabase_request_maps_transport_error(monkeypatch):
    attempts = {"n": 0}

    class BoomClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def request(self, *args, **kwargs):
            attempts["n"] += 1
            raise httpx.ConnectError("closed")

    monkeypatch.setattr(httpx, "Client", BoomClient)
    monkeypatch.setattr("app.http_supabase.time.sleep", lambda *_: None)

    with pytest.raises(ApiError) as exc:
        supabase_request("GET", "https://example.test", headers={})
    assert exc.value.status_code == 503
    assert exc.value.code == "API_UNAVAILABLE"
    assert attempts["n"] == 3


def test_supabase_request_retries_then_succeeds(monkeypatch):
    attempts = {"n": 0}

    class FlakyClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def request(self, *args, **kwargs):
            attempts["n"] += 1
            if attempts["n"] < 2:
                raise httpx.ConnectError("closed")
            return httpx.Response(200, json={"ok": True})

    monkeypatch.setattr(httpx, "Client", FlakyClient)
    monkeypatch.setattr("app.http_supabase.time.sleep", lambda *_: None)

    res = supabase_request("GET", "https://example.test", headers={})
    assert res.status_code == 200
    assert attempts["n"] == 2
