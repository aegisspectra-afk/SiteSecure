from app.errors import ApiError
from app.project_from_quote import plan_project_from_quote, project_name_from_quote


def test_approved_quote_plans_project():
    plan = plan_project_from_quote(
        quote={
            "id": "q1",
            "workspace_id": "w1",
            "status": "approved",
            "customer_id": "c1",
            "site_id": "s1",
            "title": "מערכת מצלמות",
            "number": "1042",
        },
        workspace_id="w1",
    )
    assert plan.name == "מערכת מצלמות"
    assert plan.customer_id == "c1"
    assert plan.site_id == "s1"
    assert plan.source_quote_id == "q1"
    assert plan.status == "planned"


def test_project_name_falls_back_to_project_name_then_number():
    assert (
        project_name_from_quote({"title": "", "project_name": "התקנה", "number": "1"})
        == "התקנה"
    )
    assert project_name_from_quote({"title": None, "project_name": None, "number": "99"}) == "פרויקט מהצעה #99"


def test_draft_quote_cannot_create_project():
    try:
        plan_project_from_quote(
            quote={
                "id": "q1",
                "workspace_id": "w1",
                "status": "draft",
                "customer_id": "c1",
            },
            workspace_id="w1",
        )
        raise AssertionError("expected ApiError")
    except ApiError as exc:
        assert exc.status_code == 409
        assert exc.code == "RESOURCE_STATE"
        assert "לא אושרה" in exc.message


def test_rejected_quote_cannot_create_project():
    try:
        plan_project_from_quote(
            quote={
                "id": "q1",
                "workspace_id": "w1",
                "status": "rejected",
                "customer_id": "c1",
            },
            workspace_id="w1",
        )
        raise AssertionError("expected ApiError")
    except ApiError as exc:
        assert exc.status_code == 409
        assert "מצב הנוכחי" in exc.message


def test_nonexistent_quote_fails():
    try:
        plan_project_from_quote(quote=None, workspace_id="w1")
        raise AssertionError("expected ApiError")
    except ApiError as exc:
        assert exc.status_code == 404
        assert exc.code == "NOT_FOUND"


def test_cross_workspace_quote_fails():
    try:
        plan_project_from_quote(
            quote={
                "id": "q1",
                "workspace_id": "other",
                "status": "approved",
                "customer_id": "c1",
            },
            workspace_id="w1",
        )
        raise AssertionError("expected ApiError")
    except ApiError as exc:
        assert exc.status_code == 404


def test_duplicate_project_cannot_be_created():
    try:
        plan_project_from_quote(
            quote={
                "id": "q1",
                "workspace_id": "w1",
                "status": "approved",
                "customer_id": "c1",
            },
            workspace_id="w1",
            existing_project={"id": "p1"},
        )
        raise AssertionError("expected ApiError")
    except ApiError as exc:
        assert exc.status_code == 409
        assert "כבר קיים" in exc.message
        assert exc.details.get("project_id") == "p1"


def test_customer_and_site_derived_from_quote():
    plan = plan_project_from_quote(
        quote={
            "id": "q9",
            "workspace_id": "w1",
            "status": "approved",
            "customer_id": "cust-9",
            "site_id": "site-9",
            "title": "אזעקה",
        },
        workspace_id="w1",
    )
    assert plan.customer_id == "cust-9"
    assert plan.site_id == "site-9"
    assert plan.source_quote_id == "q9"


def test_quote_without_customer_fails():
    try:
        plan_project_from_quote(
            quote={
                "id": "q1",
                "workspace_id": "w1",
                "status": "approved",
                "customer_id": None,
            },
            workspace_id="w1",
        )
        raise AssertionError("expected ApiError")
    except ApiError as exc:
        assert exc.status_code == 409
        assert "לקוח" in exc.message


def test_quote_without_site_fails():
    try:
        plan_project_from_quote(
            quote={
                "id": "q1",
                "workspace_id": "w1",
                "status": "approved",
                "customer_id": "c1",
                "site_id": None,
            },
            workspace_id="w1",
        )
        raise AssertionError("expected ApiError")
    except ApiError as exc:
        assert exc.status_code == 409
        assert "אתר" in exc.message
