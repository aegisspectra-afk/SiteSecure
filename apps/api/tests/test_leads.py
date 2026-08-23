def test_lead_create_payload_accepts_opportunity_fields():
    """LeadCreate model includes opportunity workflow fields."""
    from app.routers.ops_modules import LeadCreate, LeadPatch

    create = LeadCreate(
        title="מערכת מצלמות",
        status="visit_scheduling",
        priority="high",
        service_type="cctv",
        next_action="תיאום ביקור מחר אחה״צ",
        requirements={"camera_count": 9},
    )
    assert create.priority == "high"
    assert create.service_type == "cctv"

    patch = LeadPatch(status="visit_scheduled")
    dumped = patch.model_dump(exclude_none=True)
    assert dumped["status"] == "visit_scheduled"

def test_task_create_accepts_visit_fields():
    from app.routers.ops_modules import TaskCreate

    body = TaskCreate(
        title="ביקור",
        type="visit",
        lead_id="00000000-0000-0000-0000-000000000001",
        time_window="afternoon",
        visit_status="pending_schedule",
    )
    assert body.type == "visit"
    assert body.time_window == "afternoon"
