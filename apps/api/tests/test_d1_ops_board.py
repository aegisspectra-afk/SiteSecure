"""D1 ops card: today's jobs per technician and unassigned jobs (no billing state: none exists)."""

from __future__ import annotations

from tests.test_dashboard import _build


def _job(job_id: str, status: str, when: str, completed_at: str | None = None) -> dict:
    return {
        "id": job_id,
        "number": job_id.upper(),
        "status": status,
        "customer_id": "c1",
        "site_id": "s1",
        "scheduled_for": when,
        "completed_at": completed_at,
    }


TODAY_9 = "2026-08-14T09:00:00+00:00"
TODAY_13 = "2026-08-14T13:00:00+00:00"
TOMORROW = "2026-08-15T09:00:00+00:00"


def _jobs() -> list[dict]:
    return [
        _job("j-dana-1", "scheduled", TODAY_13),
        _job("j-dana-2", "in_progress", TODAY_9),
        _job("j-dana-done", "completed", TODAY_9, completed_at="2026-08-14T11:00:00+00:00"),
        _job("j-avi-1", "en_route", TODAY_9),
        _job("j-pair", "scheduled", TODAY_13),
        _job("j-free-today", "scheduled", TODAY_13),
        _job("j-free-tomorrow", "scheduled", TOMORROW),
        _job("j-dana-tomorrow", "scheduled", TOMORROW),
        _job("j-cancelled", "cancelled", TODAY_9),
    ]


ASSIGNEES = {
    "j-dana-1": {"u-dana"},
    "j-dana-2": {"u-dana"},
    "j-dana-done": {"u-dana"},
    "j-avi-1": {"u-avi"},
    "j-pair": {"u-dana", "u-gone"},
    "j-dana-tomorrow": {"u-dana"},
}


def test_ops_board_counts_today_per_technician_and_unassigned():
    payload = _build(
        "owner",
        jobs=_jobs(),
        job_assignees=ASSIGNEES,
        member_names={"u-dana": "דנה", "u-avi": "אבי"},
    )
    board = payload["ops_board"]
    by_user = {row["user_id"]: row for row in board["technicians"]}

    assert by_user["u-dana"] == {
        "user_id": "u-dana",
        "name": "דנה",
        "jobs_today": 4,  # scheduled, in progress, completed today, shared job; not tomorrow
        "in_progress": 1,
        "completed": 1,
    }
    assert by_user["u-avi"]["jobs_today"] == 1 and by_user["u-avi"]["in_progress"] == 1
    # An assignee whose name we cannot read is shown as unknown, never invented.
    assert by_user["u-gone"]["name"] == "לא ידוע"
    assert [row["user_id"] for row in board["technicians"]][0] == "u-dana"

    assert board["unassigned_today"] == 1  # j-free-today
    assert board["unassigned_open"] == 2  # j-free-today + j-free-tomorrow; cancelled is not open
    assert board["jobs_today"] == 6


def test_ops_board_only_for_roles_with_reliable_assignments():
    assert _build("owner", jobs=_jobs(), job_assignees=ASSIGNEES)["ops_board"] is not None
    for role in ("sales", "technician", "viewer"):
        assert _build(role, jobs=_jobs(), job_assignees=ASSIGNEES)["ops_board"] is None, role


def test_ops_board_empty_day():
    board = _build("owner", jobs=[], job_assignees={})["ops_board"]
    assert board == {"technicians": [], "jobs_today": 0, "unassigned_today": 0, "unassigned_open": 0}
