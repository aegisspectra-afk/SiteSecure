from __future__ import annotations

from app.routers.workspaces import _invite_rpc_error


def test_invite_rpc_error_maps_seat_limit():
    err = _invite_rpc_error('ERROR: PLAN_LIMIT_REACHED')
    assert err.status_code == 403
    assert err.code == "PLAN_LIMIT_REACHED"


def test_invite_rpc_error_maps_expired():
    err = _invite_rpc_error('raise exception INVITE_EXPIRED')
    assert err.status_code == 400
    assert err.code == "INVITE_EXPIRED"


def test_invite_rpc_error_maps_role():
    err = _invite_rpc_error("ROLE_NOT_ALLOWED detail")
    assert err.status_code == 403
    assert err.code == "ROLE_NOT_ALLOWED"


def test_invite_rpc_error_maps_mismatch():
    err = _invite_rpc_error("INVITE_EMAIL_MISMATCH")
    assert err.status_code == 403
    assert err.code == "INVITE_EMAIL_MISMATCH"


def test_invite_rpc_error_maps_already_accepted():
    err = _invite_rpc_error("INVITE_ALREADY_ACCEPTED")
    assert err.status_code == 409
    assert err.code == "INVITE_ALREADY_ACCEPTED"


def test_invite_rpc_error_defaults_invalid():
    err = _invite_rpc_error("something else")
    assert err.status_code == 400
    assert err.code == "INVITE_INVALID"
