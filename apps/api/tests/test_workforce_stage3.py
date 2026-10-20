"""Stage 3: regions/sites CRUD, positions list, manual shifts, tenant isolation."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.authz.catalog import load_catalog
from app.authz.types import AuthzContext
from app.deps import current_user, user_client
from app.errors import ApiError
from app.main import app
from app.workforce.directory import create_site, delete_region, list_positions, list_regions
from app.workforce.shifts import create_shift, update_shift

load_catalog.cache_clear()

WS_A = "00000000-0000-0000-0000-0000000000a1"
WS_B = "00000000-0000-0000-0000-0000000000b2"
USER = "00000000-0000-0000-0000-0000000000c3"


class FakeRes:
    def __init__(self, status_code: int, data=None, text: str = ""):
        self.status_code = status_code
        self._data = data
        self.text = text

    def json(self):
        return self._data


class StageStore:
    def __init__(self) -> None:
        self.tables: dict[str, list[dict]] = {
            "workforce_regions": [],
            "workforce_sites": [],
            "workforce_positions": [],
            "workforce_employees": [],
            "workforce_memberships": [],
            "workforce_shifts": [],
        }

    def _cmp(self, cell: str, op: str, value: str) -> bool:
        if op == "eq":
            return cell == value
        if op == "gte":
            return cell >= value
        if op == "gt":
            return cell > value
        if op == "lte":
            return cell <= value
        if op == "lt":
            return cell < value
        return False

    def _filter(self, table: str, params: dict | None) -> list[dict]:
        rows = list(self.tables.get(table, []))
        for key, val in (params or {}).items():
            if key in {"select", "limit", "order"}:
                continue
            if not isinstance(val, str):
                continue
            if key == "and" and val.startswith("(") and val.endswith(")"):
                parts = val[1:-1].split(",")
                kept = []
                for row in rows:
                    ok = True
                    for part in parts:
                        field, op, value = part.split(".", 2)
                        if not self._cmp(str(row.get(field) or ""), op, value):
                            ok = False
                            break
                    if ok:
                        kept.append(row)
                rows = kept
                continue
            if val.startswith("eq."):
                want = val[3:]
                rows = [row for row in rows if str(row.get(key) or "") == want]
            elif val.startswith("in.(") and val.endswith(")"):
                ids = {item for item in val[4:-1].split(",") if item}
                rows = [row for row in rows if str(row.get(key) or "") in ids]
        limit = int((params or {}).get("limit") or 500)
        return rows[:limit]

    def get(self, path: str, params: dict | None = None):
        return FakeRes(200, self._filter(path, params))

    def post(self, path: str, json: dict | list | None = None, params: dict | None = None):
        row = dict(json or {})
        if "password" in row:
            raise AssertionError("password written to business table")
        if path in {"workforce_regions", "workforce_sites", "workforce_positions"}:
            name = row.get("name")
            workspace_id = row.get("workspace_id")
            if any(
                item.get("name") == name and item.get("workspace_id") == workspace_id
                for item in self.tables.get(path, [])
            ):
                return FakeRes(409, {"code": "23505", "message": "duplicate"}, "duplicate")
        row.setdefault("id", str(uuid4()))
        row.setdefault("is_active", True)
        self.tables.setdefault(path, []).append(row)
        return FakeRes(201, [row])

    def patch(self, path: str, json: dict, params: dict | None = None, *, prefer: str | None = None):
        rows = self._filter(path, params)
        for row in rows:
            row.update(json)
        return FakeRes(200, rows)

    def delete(self, path: str, params: dict | None = None, *, prefer: str | None = None):
        remove = {row.get("id") for row in self._filter(path, params)}
        self.tables[path] = [row for row in self.tables.get(path, []) if row.get("id") not in remove]
        return FakeRes(204, [])

    def rpc(self, name: str, payload: dict):
        return FakeRes(200, {"ok": True})


def _features(*extra: str) -> frozenset[str]:
    catalog = load_catalog()
    return catalog["_plan_features"]["business"] if not extra else frozenset(extra)


def _ctx(role: str, workspace_id: str = WS_A, features=None, grants=None) -> AuthzContext:
    return AuthzContext(
        user_id=USER,
        workspace_id=workspace_id,
        role_key=role,
        workspace_status="active",
        subscription_status="active",
        plan_key="business",
        features=_features() if features is None else frozenset(features),
        grants=grants or frozenset(),
    )


def _bind(monkeypatch, store: StageStore, ctx: AuthzContext):
    def load(_client, _user_id, workspace_id: str):
        if workspace_id != ctx.workspace_id:
            raise ApiError(404, "NOT_FOUND", "לא נמצא")
        return ctx

    monkeypatch.setattr("app.routers.workforce.load_authz_context", load)
    app.dependency_overrides[current_user] = lambda: {"id": USER, "email": "mgr@example.com"}
    app.dependency_overrides[user_client] = lambda: store
    return TestClient(app)


def _iso(hours: int = 8) -> tuple[str, str]:
    start = datetime(2026, 10, 21, hours, 0, tzinfo=timezone.utc)
    end = start + timedelta(hours=8)
    return start.isoformat().replace("+00:00", "Z"), end.isoformat().replace("+00:00", "Z")


def _seed_directory(store: StageStore) -> dict[str, str]:
    region_a = store.post("workforce_regions", {"workspace_id": WS_A, "name": "צפון"}).json()[0]["id"]
    region_b = store.post("workforce_regions", {"workspace_id": WS_B, "name": "דרום זר"}).json()[0]["id"]
    site_a = store.post("workforce_sites", {"workspace_id": WS_A, "name": "אתר א", "region_id": region_a}).json()[0]["id"]
    site_b = store.post("workforce_sites", {"workspace_id": WS_B, "name": "אתר ב", "region_id": region_b}).json()[0]["id"]
    pos_a = store.post("workforce_positions", {"workspace_id": WS_A, "name": "מאבטח"}).json()[0]["id"]
    pos_b = store.post("workforce_positions", {"workspace_id": WS_B, "name": "מאבטח זר"}).json()[0]["id"]
    emp_a = store.post(
        "workforce_employees",
        {"workspace_id": WS_A, "first_name": "דנה", "last_name": "א", "employment_status": "active"},
    ).json()[0]["id"]
    emp_b = store.post(
        "workforce_employees",
        {"workspace_id": WS_B, "first_name": "בועז", "last_name": "ב", "employment_status": "active"},
    ).json()[0]["id"]
    return {
        "region_a": region_a,
        "region_b": region_b,
        "site_a": site_a,
        "site_b": site_b,
        "pos_a": pos_a,
        "pos_b": pos_b,
        "emp_a": emp_a,
        "emp_b": emp_b,
    }


def test_sites_view_sees_own_workspace_only():
    store = StageStore()
    ids = _seed_directory(store)
    regions = list_regions(store, WS_A)
    assert {row["id"] for row in regions} == {ids["region_a"]}
    positions = list_positions(store, WS_A)
    assert {row["id"] for row in positions} == {ids["pos_a"]}
    assert all(row["workspace_id"] == WS_A for row in positions)


def test_delete_region_blocked_when_site_linked():
    store = StageStore()
    ids = _seed_directory(store)
    with pytest.raises(ApiError) as exc:
        delete_region(store, WS_A, ids["region_a"])
    assert exc.value.status_code == 409
    assert exc.value.code == "WORKFORCE_IN_USE"
    assert store.tables["workforce_regions"]


def test_foreign_site_ref_rejected_on_create():
    store = StageStore()
    ids = _seed_directory(store)
    with pytest.raises(ApiError) as exc:
        create_site(store, WS_A, {"name": "חדירה", "region_id": ids["region_b"]})
    assert exc.value.status_code == 400
    assert "אינו שייך" in exc.value.message


def test_foreign_shift_refs_rejected():
    store = StageStore()
    ids = _seed_directory(store)
    starts, ends = _iso()
    with pytest.raises(ApiError) as exc:
        create_shift(
            store,
            WS_A,
            {
                "employee_id": ids["emp_b"],
                "site_id": ids["site_a"],
                "starts_at": starts,
                "ends_at": ends,
            },
        )
    assert exc.value.status_code == 400
    with pytest.raises(ApiError) as exc:
        create_shift(
            store,
            WS_A,
            {
                "employee_id": ids["emp_a"],
                "site_id": ids["site_b"],
                "starts_at": starts,
                "ends_at": ends,
            },
        )
    assert exc.value.status_code == 400


def test_shift_update_rejects_foreign_position():
    store = StageStore()
    ids = _seed_directory(store)
    starts, ends = _iso()
    created = create_shift(
        store,
        WS_A,
        {
            "employee_id": ids["emp_a"],
            "site_id": ids["site_a"],
            "position_id": ids["pos_a"],
            "starts_at": starts,
            "ends_at": ends,
        },
    )
    with pytest.raises(ApiError) as exc:
        update_shift(store, WS_A, created["id"], {"position_id": ids["pos_b"]})
    assert exc.value.status_code == 400


def test_http_sites_view_own_workspace_only(monkeypatch):
    store = StageStore()
    ids = _seed_directory(store)
    grants = frozenset({"workforce.view", "workforce.sites.view"})
    client = _bind(monkeypatch, store, _ctx("viewer", grants=grants))
    try:
        res = client.get(f"/api/v1/workspaces/{WS_A}/workforce/sites", headers={"Authorization": "Bearer t"})
        assert res.status_code == 200
        assert {row["id"] for row in res.json()["items"]} == {ids["site_a"]}
        other = client.get(f"/api/v1/workspaces/{WS_B}/workforce/sites", headers={"Authorization": "Bearer t"})
        assert other.status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_http_without_sites_view_denied(monkeypatch):
    store = StageStore()
    _seed_directory(store)
    client = _bind(monkeypatch, store, _ctx("technician"))
    try:
        res = client.get(f"/api/v1/workspaces/{WS_A}/workforce/sites", headers={"Authorization": "Bearer t"})
        assert res.status_code == 403
        assert res.json()["error"]["code"] == "PERMISSION_DENIED"
        assert "items" not in res.json()
    finally:
        app.dependency_overrides.clear()


def test_http_without_manage_cannot_mutate(monkeypatch):
    store = StageStore()
    ids = _seed_directory(store)
    grants = frozenset({"workforce.view", "workforce.sites.view"})
    client = _bind(monkeypatch, store, _ctx("viewer", grants=grants))
    try:
        created = client.post(
            f"/api/v1/workspaces/{WS_A}/workforce/regions",
            headers={"Authorization": "Bearer t"},
            json={"name": "מרכז"},
        )
        assert created.status_code == 403
        patched = client.patch(
            f"/api/v1/workspaces/{WS_A}/workforce/sites/{ids['site_a']}",
            headers={"Authorization": "Bearer t"},
            json={"name": "שינוי"},
        )
        assert patched.status_code == 403
        deleted = client.delete(
            f"/api/v1/workspaces/{WS_A}/workforce/sites/{ids['site_a']}",
            headers={"Authorization": "Bearer t"},
        )
        assert deleted.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_http_manager_mutates_own_workspace_only(monkeypatch):
    store = StageStore()
    ids = _seed_directory(store)
    client = _bind(monkeypatch, store, _ctx("manager"))
    try:
        created = client.post(
            f"/api/v1/workspaces/{WS_A}/workforce/regions",
            headers={"Authorization": "Bearer t"},
            json={"name": "מרכז"},
        )
        assert created.status_code == 201
        assert created.json()["workspace_id"] == WS_A
        other = client.post(
            f"/api/v1/workspaces/{WS_B}/workforce/regions",
            headers={"Authorization": "Bearer t"},
            json={"name": "חדירה"},
        )
        assert other.status_code == 404
        stolen = client.patch(
            f"/api/v1/workspaces/{WS_A}/workforce/regions/{ids['region_b']}",
            headers={"Authorization": "Bearer t"},
            json={"name": "גניבה"},
        )
        assert stolen.status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_http_spoofed_workspace_id_rejected(monkeypatch):
    store = StageStore()
    ids = _seed_directory(store)
    client = _bind(monkeypatch, store, _ctx("manager"))
    try:
        res = client.patch(
            f"/api/v1/workspaces/{WS_A}/workforce/sites/{ids['site_a']}",
            headers={"Authorization": "Bearer t"},
            json={"name": "נסיון העברה", "workspace_id": WS_B},
        )
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "VALIDATION_ERROR"
        assert store._filter("workforce_sites", {"id": f"eq.{ids['site_a']}"})[0]["workspace_id"] == WS_A
    finally:
        app.dependency_overrides.clear()


def test_http_positions_isolated(monkeypatch):
    store = StageStore()
    ids = _seed_directory(store)
    client = _bind(monkeypatch, store, _ctx("viewer"))
    try:
        res = client.get(f"/api/v1/workspaces/{WS_A}/workforce/positions", headers={"Authorization": "Bearer t"})
        assert res.status_code == 200
        assert {row["id"] for row in res.json()["items"]} == {ids["pos_a"]}
    finally:
        app.dependency_overrides.clear()


def test_http_shift_foreign_ref_and_delete_permission(monkeypatch):
    store = StageStore()
    ids = _seed_directory(store)
    starts, ends = _iso()
    manager = _bind(monkeypatch, store, _ctx("manager"))
    try:
        bad = manager.post(
            f"/api/v1/workspaces/{WS_A}/workforce/shifts",
            headers={"Authorization": "Bearer t"},
            json={
                "employee_id": ids["emp_b"],
                "site_id": ids["site_a"],
                "starts_at": starts,
                "ends_at": ends,
            },
        )
        assert bad.status_code == 400
        created = manager.post(
            f"/api/v1/workspaces/{WS_A}/workforce/shifts",
            headers={"Authorization": "Bearer t"},
            json={
                "employee_id": ids["emp_a"],
                "site_id": ids["site_a"],
                "position_id": ids["pos_a"],
                "starts_at": starts,
                "ends_at": ends,
            },
        )
        assert created.status_code == 201
        shift_id = created.json()["id"]
    finally:
        app.dependency_overrides.clear()

    viewer = _bind(monkeypatch, store, _ctx("viewer"))
    try:
        listed = viewer.get(
            f"/api/v1/workspaces/{WS_A}/workforce/shifts",
            headers={"Authorization": "Bearer t"},
            params={
                "starts_from": "2026-10-21T00:00:00Z",
                "starts_to": "2026-10-22T00:00:00Z",
            },
        )
        assert listed.status_code == 200
        assert listed.json()["items"]
        denied = viewer.delete(
            f"/api/v1/workspaces/{WS_A}/workforce/shifts/{shift_id}",
            headers={"Authorization": "Bearer t"},
        )
        assert denied.status_code == 403
    finally:
        app.dependency_overrides.clear()

    manager = _bind(monkeypatch, store, _ctx("manager"))
    try:
        deleted = manager.delete(
            f"/api/v1/workspaces/{WS_A}/workforce/shifts/{shift_id}",
            headers={"Authorization": "Bearer t"},
        )
        assert deleted.status_code == 204
        assert not store._filter("workforce_shifts", {"id": f"eq.{shift_id}"})
    finally:
        app.dependency_overrides.clear()


def test_http_feature_off_blocks_workforce(monkeypatch):
    store = StageStore()
    _seed_directory(store)
    client = _bind(monkeypatch, store, _ctx("owner", features={"core", "crm"}))
    try:
        res = client.get(f"/api/v1/workspaces/{WS_A}/workforce/sites", headers={"Authorization": "Bearer t"})
        assert res.status_code == 403
        assert res.json()["error"]["code"] == "FEATURE_NOT_INCLUDED"
        create = client.post(
            f"/api/v1/workspaces/{WS_A}/workforce/shifts",
            headers={"Authorization": "Bearer t"},
            json={"employee_id": str(uuid4()), "site_id": str(uuid4()), "starts_at": _iso()[0], "ends_at": _iso()[1]},
        )
        assert create.status_code == 403
        assert create.json()["error"]["code"] == "FEATURE_NOT_INCLUDED"
    finally:
        app.dependency_overrides.clear()


def test_http_unauthenticated_and_legitimate_get(monkeypatch):
    raw = TestClient(app)
    secret = "LeakMe99"
    res = raw.get(f"/api/v1/workspaces/{WS_A}/workforce/sites")
    assert res.status_code == 401
    assert secret not in res.text
    store = StageStore()
    _seed_directory(store)
    client = _bind(monkeypatch, store, _ctx("manager"))
    try:
        employees = client.get(f"/api/v1/workspaces/{WS_A}/workforce/employees", headers={"Authorization": "Bearer t"})
        assert employees.status_code == 200
        regions = client.get(f"/api/v1/workspaces/{WS_A}/workforce/regions", headers={"Authorization": "Bearer t"})
        assert regions.status_code == 200
        summary = client.get(f"/api/v1/workspaces/{WS_A}/workforce/summary", headers={"Authorization": "Bearer t"})
        assert summary.status_code == 200
    finally:
        app.dependency_overrides.clear()


def test_openapi_includes_stage3_paths():
    client = TestClient(app)
    paths = client.get("/api/openapi.json").json()["paths"]
    base = "/api/v1/workspaces/{workspace_id}/workforce"
    assert f"{base}/regions" in paths
    assert f"{base}/sites" in paths
    assert f"{base}/positions" in paths
    assert f"{base}/shifts" in paths
    assert "get" in paths[f"{base}/positions"]
    assert "post" not in paths[f"{base}/positions"]
    assert "/register" not in paths
