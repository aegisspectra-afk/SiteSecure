"""Unit: SSP manager-provisioned Auth user + membership + office."""

from __future__ import annotations

from uuid import uuid4

import pytest

from app.errors import ApiError
from app.ssp.provision import CreateSspUserInput, provision_ssp_user, validate_create_input

WS = "ws-ssp"
COMPANY = "co-1"
ACTOR = "owner-1"
PASSWORD = "Secret9x"


class FakeRes:
    def __init__(self, status_code: int, data=None, text: str = ""):
        self.status_code = status_code
        self._data = data
        self.text = text

    def json(self):
        return self._data


class FakeStore:
    def __init__(self) -> None:
        self.tables: dict[str, list[dict]] = {
            "profiles": [],
            "workspace_memberships": [],
            "ssp_memberships": [],
            "ssp_site_members": [],
            "ssp_sites": [{"id": "site-1", "workspace_id": WS, "name": "שפלה 2", "kind": "office"}],
        }
        self.auth_users: dict[str, dict] = {}
        self.fail_post: set[str] = set()
        self.auth_create_bodies: list[dict] = []

    def _filter(self, table: str, params: dict | None) -> list[dict]:
        rows = list(self.tables.get(table, []))
        for key, val in (params or {}).items():
            if key in {"select", "limit", "order"}:
                continue
            if isinstance(val, str) and val.startswith("eq."):
                want = val[3:]
                rows = [row for row in rows if str(row.get(key) or "") == want]
        return rows

    def get(self, path: str, params: dict | None = None):
        return FakeRes(200, self._filter(path, params))

    def post(self, path: str, json: dict | list | None = None, params: dict | None = None):
        if path in self.fail_post:
            return FakeRes(500, {}, "fail")
        row = dict(json or {})
        if "password" in row:
            raise AssertionError("password written to business table")
        row.setdefault("id", str(uuid4()))
        self.tables.setdefault(path, []).append(row)
        return FakeRes(201, [row])

    def patch(self, path: str, json: dict, params: dict | None = None, *, prefer: str | None = None):
        rows = self._filter(path, params)
        for row in rows:
            row.update(json)
        return FakeRes(200, rows)

    def auth_admin_create_user(self, body: dict):
        self.auth_create_bodies.append({k: v for k, v in body.items() if k != "password"})
        if any(user.get("email") == body.get("email") for user in self.auth_users.values()):
            return FakeRes(422, {}, "already registered")
        uid = str(uuid4())
        self.auth_users[uid] = {"id": uid, "email": body.get("email")}
        return FakeRes(201, {"id": uid, "email": body.get("email")})

    def auth_admin_get_user_by_email(self, email: str):
        for user in self.auth_users.values():
            if user.get("email") == email:
                return FakeRes(200, {"users": [user]})
        return FakeRes(200, {"users": []})

    def auth_admin_get_user(self, user_id: str):
        user = self.auth_users.get(user_id)
        return FakeRes(200, user or {})


def _payload(**kwargs) -> CreateSspUserInput:
    base = CreateSspUserInput(
        full_name="עובד בדיקה",
        email="ssp-user@sitesecure.test",
        password=PASSWORD,
        product_role="patrol_officer",
        site_pk="site-1",
    )
    for key, value in kwargs.items():
        setattr(base, key, value)
    return base


def test_validate_rejects_short_password():
    with pytest.raises(ApiError) as exc:
        validate_create_input(_payload(password="ab12"))
    assert exc.value.status_code == 400


def test_provision_creates_auth_membership_and_office():
    store = FakeStore()
    out = provision_ssp_user(
        store,
        workspace_id=WS,
        company_pk=COMPANY,
        actor_user_id=ACTOR,
        payload=_payload(),
        occupied_roles=["owner"],
        plan_key="business",
    )
    assert out["created_auth"] is True
    assert out["email"] == "ssp-user@sitesecure.test"
    assert out["product_role"] == "patrol_officer"
    assert out["sites"][0]["id"] == "site-1"
    assert store.tables["workspace_memberships"][0]["role_key"] == "technician"
    assert store.tables["ssp_memberships"][0]["status"] == "active"
    assert store.auth_create_bodies[0]["app_metadata"]["provisioned_via"] == "ssp"
    assert "password" not in store.auth_create_bodies[0]


def test_provision_conflict_when_already_ssp_member():
    store = FakeStore()
    first = provision_ssp_user(
        store,
        workspace_id=WS,
        company_pk=COMPANY,
        actor_user_id=ACTOR,
        payload=_payload(),
        occupied_roles=["owner"],
        plan_key="business",
    )
    with pytest.raises(ApiError) as exc:
        provision_ssp_user(
            store,
            workspace_id=WS,
            company_pk=COMPANY,
            actor_user_id=ACTOR,
            payload=_payload(),
            occupied_roles=["owner", "technician"],
            plan_key="business",
        )
    assert exc.value.status_code == 409
    assert exc.value.code == "SSP_ACCOUNT_CONFLICT"
    assert "שטח" not in exc.value.message
    assert exc.value.code != "PLAN_LIMIT_REACHED"
    assert first["user_id"]


def test_provision_solo_field_seat_limit_names_quota():
    store = FakeStore()
    with pytest.raises(ApiError) as exc:
        provision_ssp_user(
            store,
            workspace_id=WS,
            company_pk=COMPANY,
            actor_user_id=ACTOR,
            payload=_payload(),
            occupied_roles=["owner", "technician", "technician", "viewer"],
            plan_key="solo",
        )
    assert exc.value.status_code == 409
    assert exc.value.code == "PLAN_LIMIT_REACHED"
    assert exc.value.details["limit_key"] == "max_members"
    assert exc.value.details["limit"] == 1
    assert "צוות" in exc.value.message
    assert f"{exc.value.details['current']}/{exc.value.details['limit']}" in exc.value.message


def test_provision_does_not_delete_auth_on_later_failure():
    store = FakeStore()
    store.fail_post.add("ssp_memberships")
    with pytest.raises(ApiError) as exc:
        provision_ssp_user(
            store,
            workspace_id=WS,
            company_pk=COMPANY,
            actor_user_id=ACTOR,
            payload=_payload(),
            occupied_roles=["owner"],
            plan_key="business",
        )
    assert exc.value.code == "SSP_PARTIAL_RECOVERY"
    assert store.auth_users
    assert not hasattr(store, "deleted_auth") or not getattr(store, "deleted_auth", None)


def test_user_repr_hides_password():
    assert "Secret" not in repr(_payload())
    assert "password='***'" in repr(_payload())
