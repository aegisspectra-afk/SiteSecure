"""Q4: POST …/quotes/{id}/cancel must exist (not 404)."""

from fastapi.testclient import TestClient

from app.main import app

WS = "00000000-0000-0000-0000-000000000001"
QID = "00000000-0000-0000-0000-000000000002"


def test_cancel_quote_route_is_registered():
    api = TestClient(app)
    res = api.post(f"/api/v1/workspaces/{WS}/quotes/{QID}/cancel")
    # Missing route → 404. Auth/deps may return 401/403/422 — all prove the route exists.
    assert res.status_code != 404, res.text
