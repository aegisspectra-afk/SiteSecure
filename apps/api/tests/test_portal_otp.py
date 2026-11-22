"""Portal OTP login — routes and phone normalization."""

from fastapi.testclient import TestClient

from app.main import app
from app.portal_otp import normalize_portal_phone, otp_code_hash


def test_portal_otp_request_route_registered():
    api = TestClient(app)
    res = api.post("/api/v1/portal/otp/request-code", json={"phone": "0501234567"})
    assert res.status_code != 404, res.text


def test_portal_otp_verify_route_registered():
    api = TestClient(app)
    res = api.post("/api/v1/portal/otp/verify", json={"phone": "0501234567", "code": "123456"})
    assert res.status_code != 404, res.text


def test_normalize_israeli_mobile_variants():
    assert normalize_portal_phone("050-123-4567") == "0501234567"
    assert normalize_portal_phone("+972 50 123 4567") == "0501234567"
    assert normalize_portal_phone("501234567") == "0501234567"


def test_otp_code_hash_is_stable():
    a = otp_code_hash("0501234567", "482910")
    b = otp_code_hash("0501234567", "482910")
    assert a == b
    assert a != otp_code_hash("0501234567", "482911")