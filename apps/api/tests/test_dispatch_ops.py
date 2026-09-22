"""Dispatch-first: job assign/reassign, service→job, technician scope, tenant denial."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

import httpx
import pytest

from app.authz.engine import authorize
from app.authz.types import AuthzContext, ResourceRef
from app.dashboard import build_dashboard
from app.errors import ApiError
from app.job_lifecycle import assert_transition
from app.routers import jobs as jobs_mod
from app.routers.jobs import JobAssign, JobComplete
from app.routers.ops_modules import create_job_from_service_call, ServiceCallCreateJob


WS = UUID("00000000-0000-0000-0000-0000000000aa")
JOB = UUID("00000000-0000-0000-0000-0000000000bb")
CALL = UUID("00000000-0000-0000-0000-0000000000cc")
TECH_A = "11111111-1111-1111-1111-111111111111"
TECH_B = "22222222-2222-2222-2222-222222222222"
MANAGER = "33333333-3333-3333-3333-333333333333"


def _ok(data, status=200) -> httpx.Response:
    return httpx.Response(status, json=data)


class FakeClient:
    def __init__(self) -> None:
        self.posts: list[tuple[str, dict]] = []
        self.patches: list[tuple[str, dict, dict | None]] = []
        self.deletes: list[tuple[str, dict | None]] = []
        self.rpc_calls: list[tuple[str, dict]] = []
        self.assignments: list[dict] = []
        self.profiles = {
            TECH_A: "דניאל כהן",
            TECH_B: "יוסי לוי",
            MANAGER: "מנהל תפעול",
        }
        self.memberships = {TECH_A: "technician", TECH_B: "technician"}
        self.job = {
            "id": str(JOB),
            "workspace_id": str(WS),
            "number": "J-02031",
            "title": "מצלמה בחנייה",
            "kind": "service",
            "status": "scheduled",
            "priority": "high",
            "project_id": None,
            "service_call_id": str(CALL),
            "customer_id": "cust-1",
            "site_id": "site-1",
            "scheduled_for": None,
            "scheduled_end": None,
            "started_at": None,
            "arrived_at": None,
            "completed_at": None,
            "completion_notes": None,
            "created_by": MANAGER,
            "created_at": "2026-09-18T08:00:00+00:00",
            "updated_at": "2026-09-18T08:00:00+00:00",
        }
        self.checklist: list[dict] = []
        self.service_call = {
            "id": str(CALL),
            "workspace_id": str(WS),
            "number": "SR-01042",
            "status": "open",
            "priority": "high",
            "customer_id": "cust-1",
            "site_id": "site-1",
            "system_id": "sys-1",
            "title": "מצלמה בחנייה",
            "description": "אין הקלטה",
            "created_by": MANAGER,
            "created_at": "2026-09-18T07:00:00+00:00",
            "updated_at": "2026-09-18T07:00:00+00:00",
        }

    def get(self, table: str, params: dict | None = None):
        params = params or {}
        if table == "workspace_memberships":
            uid = str(params.get("user_id", "")).replace("eq.", "")
            role = self.memberships.get(uid)
            if not role:
                return _ok([])
            return _ok([{"user_id": uid, "role_key": role}])
        if table == "assignments":
            active_only = params.get("unassigned_at") == "is.null"
            rows = []
            for row in self.assignments:
                if params.get("resource_id") and row["resource_id"] != str(params["resource_id"]).replace("eq.", ""):
                    continue
                if active_only and row.get("unassigned_at"):
                    continue
                rows.append(
                    {
                        "user_id": row["user_id"],
                        "assigned_by": row.get("assigned_by"),
                        "created_at": row.get("created_at"),
                    }
                )
            return _ok(rows)
        if table == "profiles":
            ids_raw = str(params.get("id", "")).replace("in.(", "").replace(")", "")
            ids = [i for i in ids_raw.split(",") if i]
            return _ok([{"id": i, "full_name": self.profiles.get(i, i)} for i in ids])
        if table == "jobs":
            return _ok([self.job])
        if table == "job_checklist_items":
            return _ok(self.checklist)
        if table == "service_calls":
            return _ok([self.service_call])
        if table == "sites":
            return _ok([{"id": "site-1", "customer_id": "cust-1", "name": "Hotel Orion"}])
        return _ok([])

    def post(self, table: str, payload: dict):
        self.posts.append((table, payload))
        if table == "assignments":
            row = {
                **payload,
                "id": str(uuid4()),
                "created_at": datetime.now(UTC).isoformat(),
                "unassigned_at": None,
            }
            self.assignments.append(row)
            return _ok([row], 201)
        if table == "jobs":
            created = {**self.job, **payload, "id": str(uuid4()), "number": "J-02032"}
            self.job = created
            return _ok([created], 201)
        if table == "job_checklist_items":
            return _ok([{**payload, "id": str(uuid4())}], 201)
        if table == "site_timeline_events":
            return _ok([payload], 201)
        return _ok([payload], 201)

    def patch(self, table: str, payload: dict, params: dict | None = None):
        self.patches.append((table, payload, params))
        if table == "assignments":
            uid = str((params or {}).get("user_id", "")).replace("eq.", "")
            for row in self.assignments:
                if row["user_id"] == uid and not row.get("unassigned_at"):
                    row.update(payload)
            return _ok([payload])
        if table == "jobs":
            self.job = {**self.job, **payload}
            return _ok([self.job])
        if table == "service_calls":
            self.service_call = {**self.service_call, **payload}
            return _ok([self.service_call])
        if table == "job_checklist_items":
            return _ok([{**payload, "id": "item-1"}])
        return _ok([payload])

    def delete(self, table: str, params: dict | None = None):
        self.deletes.append((table, params))
        return httpx.Response(204)

    def rpc(self, name: str, payload: dict | None = None):
        self.rpc_calls.append((name, payload or {}))
        return _ok({})


def _manager_ctx() -> AuthzContext:
    from app.authz.catalog import load_catalog

    catalog = load_catalog()
    return AuthzContext(
        user_id=MANAGER,
        workspace_id=str(WS),
        role_key="manager",
        workspace_status="active",
        subscription_status="active",
        plan_key="business",
        features=catalog["_plan_features"]["business"],
    )


def _tech_ctx(assigned: tuple[str, ...] = ()) -> AuthzContext:
    from app.authz.catalog import load_catalog

    catalog = load_catalog()
    return AuthzContext(
        user_id=TECH_A,
        workspace_id=str(WS),
        role_key="technician",
        workspace_status="active",
        subscription_status="active",
        plan_key="business",
        features=catalog["_plan_features"]["business"],
        assigned_resource_ids=frozenset(assigned),
    )


def _patch_auth(monkeypatch, ctx: AuthzContext) -> None:
    monkeypatch.setattr(jobs_mod, "_ctx", lambda *a, **k: ctx)
    monkeypatch.setattr(jobs_mod, "require", lambda *a, **k: None)


def test_assign_creates_active_assignment(monkeypatch):
    client = FakeClient()
    _patch_auth(monkeypatch, _manager_ctx())
    out = jobs_mod.assign_job(WS, JOB, JobAssign(user_id=TECH_A), client, {"id": MANAGER})
    assert out["user_id"] == TECH_A
    assert out["reassigned"] is False
    assert client.deletes == []
    assert any(table == "assignments" for table, _ in client.posts)


def test_reassign_closes_previous_without_delete(monkeypatch):
    client = FakeClient()
    client.assignments.append(
        {
            "user_id": TECH_A,
            "assigned_by": MANAGER,
            "created_at": "2026-09-18T08:32:00+00:00",
            "resource_id": str(JOB),
            "unassigned_at": None,
        }
    )
    _patch_auth(monkeypatch, _manager_ctx())
    out = jobs_mod.assign_job(WS, JOB, JobAssign(user_id=TECH_B), client, {"id": MANAGER})
    assert out["reassigned"] is True
    assert client.deletes == []
    assert any("unassigned_at" in payload for _, payload, _ in client.patches)
    closed = [row for row in client.assignments if row["user_id"] == TECH_A]
    assert closed and closed[0].get("unassigned_at")
    active = [row for row in client.assignments if row["user_id"] == TECH_B and not row.get("unassigned_at")]
    assert active


def test_technician_assign_denied_by_engine():
    d = authorize(
        ctx=_tech_ctx((str(JOB),)),
        action="jobs.assign",
        resource=ResourceRef(type="job", id=str(JOB), state="scheduled"),
    )
    assert d.allowed is False


def test_unassigned_job_denied_for_technician():
    d = authorize(
        ctx=_tech_ctx(),
        action="jobs.start",
        resource=ResourceRef(type="job", id=str(JOB), state="scheduled", site_id="site-other"),
    )
    assert d.allowed is False
    assert d.code == "SCOPE_DENIED"


def test_assigned_job_allowed_for_technician():
    d = authorize(
        ctx=_tech_ctx((str(JOB),)),
        action="jobs.start",
        resource=ResourceRef(type="job", id=str(JOB), state="scheduled"),
    )
    assert d.allowed is True


def test_cross_workspace_technician_cannot_use_foreign_job_id():
    # Authz context is always loaded for the path workspace. A job id from
    # another tenant is simply unassigned in this workspace.
    d = authorize(
        ctx=_tech_ctx(("job-in-this-workspace",)),
        action="jobs.start",
        resource=ResourceRef(type="job", id=str(JOB), state="scheduled"),
    )
    assert d.allowed is False
    assert d.code == "SCOPE_DENIED"


def test_complete_requires_in_progress_and_checklist(monkeypatch):
    client = FakeClient()
    client.job["status"] = "in_progress"
    client.checklist = [{"id": "c1", "label_he": "אבחון", "required": True, "completed": False}]
    _patch_auth(monkeypatch, _tech_ctx((str(JOB),)))
    with pytest.raises(ApiError) as exc:
        jobs_mod.complete_job(WS, JOB, JobComplete(completion_notes="done"), client, {"id": TECH_A})
    assert exc.value.code == "BUSINESS_RULE"

    client.checklist[0]["completed"] = True
    out = jobs_mod.complete_job(WS, JOB, JobComplete(completion_notes="תוקן"), client, {"id": TECH_A})
    assert out.status == "completed"
    assert out.completed_at
    assert out.completion_notes == "תוקן"
    assert client.deletes == []


def test_invalid_complete_transition_blocked(monkeypatch):
    client = FakeClient()
    client.job["status"] = "scheduled"
    _patch_auth(monkeypatch, _tech_ctx((str(JOB),)))
    with pytest.raises(ApiError) as exc:
        jobs_mod.complete_job(WS, JOB, JobComplete(), client, {"id": TECH_A})
    assert exc.value.code == "BUSINESS_RULE"


def test_service_call_create_job_preserves_relationship(monkeypatch):
    from app.routers import ops_modules as ops

    client = FakeClient()
    ctx = _manager_ctx()
    monkeypatch.setattr(ops, "_ctx", lambda *a, **k: ctx)
    monkeypatch.setattr(ops, "require", lambda *a, **k: None)
    job = create_job_from_service_call(WS, CALL, ServiceCallCreateJob(), client, {"id": MANAGER})
    assert job["service_call_id"] == str(CALL)
    assert job["customer_id"] == "cust-1"
    assert job["site_id"] == "site-1"
    assert job["priority"] == "high"
    assert job["title"] == "מצלמה בחנייה"


def test_technician_commercial_isolation_unchanged():
    ctx = _tech_ctx((str(JOB),))
    assert authorize(ctx=ctx, action="quotes.view").allowed is False
    assert authorize(ctx=ctx, action="catalog.view").allowed is False
    assert authorize(ctx=ctx, action="quotes.view_cost").allowed is False
    assert authorize(ctx=ctx, action="jobs.start").allowed is True


def test_assigned_technician_upload_allowed_out_of_scope_denied():
    allowed = authorize(
        ctx=_tech_ctx((str(JOB),)),
        action="documents.upload",
        resource=ResourceRef(type="job", id=str(JOB)),
    )
    denied = authorize(
        ctx=_tech_ctx(),
        action="documents.upload",
        resource=ResourceRef(type="job", id=str(JOB)),
    )
    assert allowed.allowed is True
    assert denied.allowed is False
    assert denied.code == "SCOPE_DENIED"


def test_today_buckets_now_next_later():
    now = datetime(2026, 9, 18, 11, 0, tzinfo=UTC)
    jobs = [
        {
            "id": "now-job",
            "number": "J-1",
            "title": "פעיל",
            "status": "en_route",
            "customer_id": "c1",
            "site_id": "s1",
            "scheduled_for": "2026-09-18T08:00:00+00:00",
        },
        {
            "id": "next-job",
            "number": "J-2",
            "title": "הבא",
            "status": "scheduled",
            "customer_id": "c1",
            "site_id": "s1",
            "scheduled_for": "2026-09-18T12:00:00+00:00",
        },
        {
            "id": "later-job",
            "number": "J-3",
            "title": "אחר כך",
            "status": "scheduled",
            "customer_id": "c1",
            "site_id": "s1",
            "scheduled_for": "2026-09-18T16:00:00+00:00",
        },
        {
            "id": "done-job",
            "number": "J-4",
            "title": "נסגר",
            "status": "completed",
            "customer_id": "c1",
            "site_id": "s1",
            "scheduled_for": "2026-09-18T07:00:00+00:00",
            "completed_at": "2026-09-18T09:00:00+00:00",
        },
    ]
    payload = build_dashboard(
        role_key="technician",
        user_id=TECH_A,
        now=now,
        tz_name="UTC",
        quotes=[],
        jobs=jobs,
        job_assignees={j["id"]: {TECH_A} for j in jobs},
        assigned_resource_ids=frozenset(j["id"] for j in jobs),
        names={"c1": "לקוח", "s1": "אתר"},
        events=[],
        can_quotes_view=False,
        can_jobs_view=True,
        can_jobs_start=True,
        can_jobs_complete=True,
        assignments_reliable=False,
    )
    by_id = {item["entity_id"]: item for item in payload["today"]["items"]}
    assert by_id["now-job"]["severity"] == "now"
    assert by_id["next-job"]["severity"] == "next"
    assert by_id["later-job"]["severity"] == "later"
    assert by_id["done-job"]["severity"] == "info"
    assert by_id["now-job"]["actions"] == ["arrived"]
    assert by_id["next-job"]["actions"] == ["en_route"]


def test_lifecycle_matrix_complete_path():
    assert assert_transition("en_route", "scheduled") == "en_route"
    assert assert_transition("arrived", "en_route") == "arrived"
    assert assert_transition("start", "arrived") == "in_progress"
    assert assert_transition("complete", "in_progress") == "completed"
