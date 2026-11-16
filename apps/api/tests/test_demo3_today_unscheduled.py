"""DEMO-3.2: the technician's "היום" follows the job date; assigned jobs with no date are
listed under "ללא מועד" instead of disappearing."""

from tests.test_dashboard import NOW, _build


def _job(jid, scheduled_for=None, status="scheduled"):
    return {"id": jid, "number": jid.upper(), "title": jid, "status": status, "customer_id": "c1",
            "site_id": "s1", "scheduled_for": scheduled_for, "scheduled_end": None}


def test_today_by_date_and_undated_jobs_under_no_date():
    jobs = [
        _job("j-today", "2026-08-14T09:00:00+00:00"),
        _job("j-tomorrow", "2026-08-15T09:00:00+00:00"),
        _job("j-nodate"),
    ]
    ids = frozenset({"j-today", "j-tomorrow", "j-nodate", "s1"})
    payload = _build("technician", jobs=jobs, assigned_resource_ids=ids, now=NOW)
    today = [i["entity_id"] for i in payload["today"]["items"]]
    assert today == ["j-today"]
    unscheduled = payload["unscheduled"]
    assert unscheduled["label_he"] == "ללא מועד"
    assert [i["entity_id"] for i in unscheduled["items"]] == ["j-nodate"]
    assert unscheduled["items"][0]["actions"] == ["en_route"]


def test_other_roles_do_not_get_the_list():
    payload = _build("owner", jobs=[_job("j-nodate")])
    assert payload.get("unscheduled") is None
