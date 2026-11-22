"""Portal MVP: customer_portal router must be mounted on the app."""

from fastapi.testclient import TestClient

from app.main import app

WS = "00000000-0000-0000-0000-000000000001"
CID = "00000000-0000-0000-0000-000000000002"


def test_portal_staff_list_route_registered():
    api = TestClient(app)
    res = api.get(f"/api/v1/workspaces/{WS}/customers/{CID}/portal")
    assert res.status_code != 404, res.text


def test_portal_session_route_registered():
    api = TestClient(app)
    res = api.get("/api/v1/portal/session")
    assert res.status_code != 404, res.text
