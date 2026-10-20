"""Unit: manager-provisioned workforce employee + Auth user."""

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.errors import ApiError
from app.user_archive import AUTH_BAN_DURATION
from app.workforce.provision import (
    CreateEmployeeInput,
    _Trace,
    _compensate,
    disable_employee_user,
    provision_employee_user,
    validate_create_input,
)
from app.workspace_rbac import WORKFORCE_MEMBER_ROLE

WS = "ws-g1"
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
            "workforce_employees": [],
            "workforce_memberships": [],
            "workforce_regions": [],
            "workforce_sites": [],
            "workforce_positions": [],
        }
        self.auth_users: dict[str, dict] = {}
        self.fail_post: set[str] = set()
        self.fail_auth_delete = False
        self.deleted_auth: list[str] = []
        self.banned: list[str] = []
        self.auth_create_bodies: list[dict] = []
        self.posted: list[tuple[str, dict]] = []

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
        self.posted.append((path, dict(row)))
        return FakeRes(201, [row])

    def patch(self, path: str, json: dict, params: dict | None = None, *, prefer: str | None = None):
        rows = self._filter(path, params)
        for row in rows:
            row.update(json)
        return FakeRes(200, rows)

    def delete(self, path: str, params: dict | None = None):
        keep = []
        remove = {row.get("id") for row in self._filter(path, params)}
        for row in self.tables.get(path, []):
            if row.get("id") not in remove:
                keep.append(row)
        self.tables[path] = keep
        return FakeRes(204, [])

    def auth_admin_create_user(self, body: dict):
        self.auth_create_bodies.append({k: v for k, v in body.items() if k != "password"})
        if any(user.get("email") == body.get("email") for user in self.auth_users.values()):
            return FakeRes(422, {}, "already registered")
        uid = str(uuid4())
        self.auth_users[uid] = {
            "id": uid,
            "email": body.get("email"),
            "app_metadata": body.get("app_metadata") or {},
            "has_password": bool(body.get("password")),
        }
        return FakeRes(200, {"id": uid})

    def auth_admin_delete_user(self, user_id: str):
        if self.fail_auth_delete:
            return FakeRes(500, {}, "cannot delete")
        self.deleted_auth.append(user_id)
        self.auth_users.pop(user_id, None)
        return FakeRes(200, {})

    def auth_admin_update_user(self, user_id: str, body: dict):
        if "password" in body and user_id in self.auth_users:
            self.auth_users[user_id]["has_password"] = True
        duration = body.get("ban_duration")
        if duration and duration != "none":
            self.banned.append(user_id)
        elif duration == "none" and user_id in self.banned:
            self.banned.remove(user_id)
        return FakeRes(200, {})

    def auth_admin_get_user(self, user_id: str):
        user = self.auth_users.get(user_id)
        if not user:
            return FakeRes(404, {}, "not found")
        return FakeRes(200, user)

    def auth_admin_get_user_by_email(self, email: str):
        users = [user for user in self.auth_users.values() if user.get("email") == email]
        return FakeRes(200, {"users": users})


def _payload(**kwargs) -> CreateEmployeeInput:
    data = dict(
        first_name="דנה",
        last_name="כהן",
        email="dana@g1.example",
        username="dana.k",
        password=PASSWORD,
    )
    data.update(kwargs)
    return CreateEmployeeInput(**data)


def _provision(store: FakeStore, payload: CreateEmployeeInput | None = None, occupied: list[str] | None = None):
    return provision_employee_user(
        store,
        workspace_id=WS,
        actor_user_id=ACTOR,
        payload=payload or _payload(),
        occupied_roles=occupied or ["owner"],
        plan_key="business",
    )


def test_input_repr_hides_password():
    text = repr(_payload())
    assert PASSWORD not in text
    assert "password='***'" in text


def test_validate_rejects_weak_password():
    with pytest.raises(ApiError) as exc:
        validate_create_input(_payload(password="short"))
    assert exc.value.code == "VALIDATION_ERROR"
    assert PASSWORD not in str(exc.value.details)


def test_happy_path_creates_workforce_only_user():
    store = FakeStore()
    created = _provision(store)
    assert created["username"] == "dana.k"
    assert created["email"] == "dana@g1.example"
    assert created["account_status"] == "linked"
    assert created["must_change_password"] is True
    assert len(store.auth_users) == 1
    auth = next(iter(store.auth_users.values()))
    assert auth["app_metadata"]["workforce_only"] is True
    assert auth["app_metadata"]["provisioned_via"] == "workforce"
    membership = store.tables["workspace_memberships"][0]
    assert membership["role_key"] == WORKFORCE_MEMBER_ROLE
    assert membership["workspace_role_key"] == WORKFORCE_MEMBER_ROLE
    assert store.tables["workforce_memberships"][0]["product_role"] == "employee"
    for table, row in store.posted:
        assert "password" not in row
        assert PASSWORD not in str(row)
        assert table != "auth"


def test_duplicate_username_conflict():
    store = FakeStore()
    store.tables["workforce_employees"].append(
        {"id": "e1", "workspace_id": WS, "username": "dana.k", "user_id": "u-existing", "email": "other@x.com"}
    )
    with pytest.raises(ApiError) as exc:
        _provision(store)
    assert exc.value.code == "WORKFORCE_USERNAME_TAKEN"
    assert store.auth_users == {}


def test_duplicate_email_conflict():
    store = FakeStore()
    store.tables["workforce_employees"].append(
        {"id": "e1", "workspace_id": WS, "username": "other", "user_id": "u-existing", "email": "dana@g1.example"}
    )
    with pytest.raises(ApiError) as exc:
        _provision(store)
    assert exc.value.code == "WORKFORCE_ACCOUNT_CONFLICT"
    assert store.auth_users == {}


def test_does_not_hijack_existing_technician():
    store = FakeStore()
    uid = "tech-1"
    store.tables["profiles"].append({"id": uid, "email": "dana@g1.example"})
    store.tables["workspace_memberships"].append(
        {"id": "m1", "user_id": uid, "workspace_id": WS, "role_key": "technician", "status": "active"}
    )
    with pytest.raises(ApiError) as exc:
        _provision(store)
    assert exc.value.code == "WORKFORCE_ACCOUNT_CONFLICT"
    assert store.tables["workforce_employees"] == []
    assert store.auth_users == {}


def test_does_not_hijack_site_secure_onboarding_profile():
    store = FakeStore()
    uid = "owner-onboarding"
    store.tables["profiles"].append({"id": uid, "email": "dana@g1.example"})
    store.auth_users[uid] = {"id": uid, "email": "dana@g1.example", "app_metadata": {}}
    with pytest.raises(ApiError) as exc:
        _provision(store)
    assert exc.value.code == "WORKFORCE_ACCOUNT_CONFLICT"
    assert store.tables["workspace_memberships"] == []
    assert uid in store.auth_users


def test_cross_tenant_conflict_does_not_reuse_user():
    store = FakeStore()
    uid = "other-org"
    store.tables["profiles"].append({"id": uid, "email": "dana@g1.example"})
    store.tables["workspace_memberships"].append(
        {
            "id": "m-other",
            "user_id": uid,
            "workspace_id": "ws-other",
            "role_key": "technician",
            "status": "active",
        }
    )
    with pytest.raises(ApiError) as exc:
        _provision(store)
    assert exc.value.code == "WORKFORCE_CROSS_TENANT"
    assert store.tables["workforce_employees"] == []


def test_partial_membership_failure_deletes_new_auth():
    store = FakeStore()
    store.fail_post.add("workspace_memberships")
    with pytest.raises(ApiError) as exc:
        _provision(store)
    assert exc.value.code == "WORKFORCE_PARTIAL_RECOVERY"
    assert store.auth_users == {}
    assert len(store.deleted_auth) == 1
    assert store.tables["workspace_memberships"] == []
    assert store.tables["workforce_employees"] == []


def test_orphan_workforce_auth_resume_after_failed_compensate():
    store = FakeStore()
    uid = "orphan-auth"
    store.auth_users[uid] = {
        "id": uid,
        "email": "dana@g1.example",
        "app_metadata": {"workforce_only": True, "provisioned_via": "workforce"},
        "has_password": True,
    }
    store.tables["profiles"].append({"id": uid, "email": "dana@g1.example"})
    created = _provision(store)
    assert created["user_id"] == uid
    assert len(store.auth_users) == 1
    assert store.tables["workspace_memberships"][0]["role_key"] == WORKFORCE_MEMBER_ROLE
    assert store.deleted_auth == []


def test_disable_bans_when_no_other_memberships():
    store = FakeStore()
    created = _provision(store)
    updated = disable_employee_user(
        store, workspace_id=WS, employee_id=created["id"], actor_user_id=ACTOR
    )
    assert updated["employment_status"] == "inactive"
    assert created["user_id"] in store.banned
    assert store.deleted_auth == []
    assert store.tables["workspace_memberships"][0]["status"] == "disabled"


def test_disable_does_not_ban_user_in_another_org():
    store = FakeStore()
    created = _provision(store)
    uid = created["user_id"]
    store.tables["workspace_memberships"].append(
        {
            "id": "m-other",
            "user_id": uid,
            "workspace_id": "ws-other",
            "role_key": "viewer",
            "status": "active",
        }
    )
    disable_employee_user(store, workspace_id=WS, employee_id=created["id"], actor_user_id=ACTOR)
    assert uid not in store.banned
    assert store.deleted_auth == []
    assert any(
        row.get("workspace_id") == "ws-other" and row.get("status") == "active"
        for row in store.tables["workspace_memberships"]
    )


def test_disable_self_blocked():
    store = FakeStore()
    created = _provision(store)
    with pytest.raises(ApiError) as exc:
        disable_employee_user(
            store, workspace_id=WS, employee_id=created["id"], actor_user_id=created["user_id"]
        )
    assert exc.value.code == "WORKFORCE_SELF_DISABLE"


def test_ban_duration_is_reversible_not_delete():
    assert AUTH_BAN_DURATION.endswith("h")
    store = FakeStore()
    created = _provision(store)
    disable_employee_user(store, workspace_id=WS, employee_id=created["id"], actor_user_id=ACTOR)
    assert store.deleted_auth == []


def test_compensate_does_not_delete_auth_belonging_to_other_org():
    store = FakeStore()
    uid = "shared-user"
    store.auth_users[uid] = {"id": uid, "email": "x@y.com", "app_metadata": {}}
    store.tables["workspace_memberships"].append(
        {
            "id": "m-other",
            "user_id": uid,
            "workspace_id": "ws-other",
            "role_key": "technician",
            "status": "active",
        }
    )
    _compensate(store, WS, _Trace(created_auth_id=uid, created_membership_id="m-this"))
    assert uid not in store.deleted_auth
    assert uid not in store.banned
    assert any(row.get("workspace_id") == "ws-other" for row in store.tables["workspace_memberships"])


def test_compensate_skips_auth_delete_when_membership_lookup_fails():
    store = FakeStore()
    uid = "orphan"
    store.auth_users[uid] = {"id": uid, "email": "x@y.com", "app_metadata": {}}

    def _boom(*_args, **_kwargs):
        raise RuntimeError("lookup failed")

    store.get = _boom  # type: ignore[method-assign]
    _compensate(store, WS, _Trace(created_auth_id=uid))
    assert store.deleted_auth == []
    assert uid not in store.banned
    assert uid in store.auth_users
