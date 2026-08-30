from datetime import UTC, datetime

from app.authz.usage import occupancy_from_rows, seat_meters

# Freeze clock so hard-coded invite expiry fixtures stay valid (not wall-clock dependent).
_FIXTURE_NOW = datetime(2026, 8, 20, 12, 0, tzinfo=UTC)


def test_owner_is_office_seat_not_field():
    occupancy = occupancy_from_rows(
        members=[
            {
                "role_key": "owner",
                "status": "active",
                "profiles": {"full_name": "Ilya Kerner", "email": "aegisspectra@gmail.com"},
            }
        ],
        invites=[],
        now=_FIXTURE_NOW,
    )
    meters = {row["key"]: row for row in seat_meters(plan_key="solo", occupants=occupancy.occupants)}
    assert occupancy.active_members == 1
    assert occupancy.pending_invites == 0
    assert meters["seats_operator"]["current"] == 1
    assert meters["seats_field"]["current"] == 0
    assert meters["seats_operator"]["occupants"][0]["label"] == "Ilya Kerner"
    assert meters["seats_operator"]["occupants"][0]["role_key"] == "owner"
    assert meters["seats_field"]["occupants"] == []


def test_duplicate_pending_invites_occupy_one_field_seat():
    occupancy = occupancy_from_rows(
        members=[{"role_key": "owner", "status": "active", "profiles": {"email": "owner@sitesecure.test"}}],
        invites=[
            {
                "email": "shimdurac@gmail.com",
                "role_key": "technician",
                "accepted_at": None,
                "expires_at": "2026-08-29T15:20:54+00:00",
                "created_at": "2026-08-15T15:20:54+00:00",
            },
            {
                "email": "SHIMDURAC@gmail.com",
                "role_key": "technician",
                "accepted_at": None,
                "expires_at": "2026-08-29T15:21:20+00:00",
                "created_at": "2026-08-15T15:21:20+00:00",
            },
        ],
        now=_FIXTURE_NOW,
    )
    meters = {row["key"]: row for row in seat_meters(plan_key="solo", occupants=occupancy.occupants)}
    assert occupancy.pending_invites == 1
    assert meters["seats_field"]["current"] == 1
    assert meters["seats_field"]["occupants"] == [
        {
            "kind": "invite",
            "role_key": "technician",
            "email": "shimdurac@gmail.com",
            "label": "shimdurac@gmail.com",
            "status": "pending",
        }
    ]
    assert meters["seats_operator"]["current"] == 1


def test_expired_and_accepted_invites_do_not_occupy_seats():
    now = datetime(2026, 8, 15, 18, 0, tzinfo=UTC)
    occupancy = occupancy_from_rows(
        members=[{"role_key": "owner", "status": "active", "profiles": {"email": "owner@sitesecure.test"}}],
        invites=[
            {
                "email": "expired@sitesecure.test",
                "role_key": "technician",
                "accepted_at": None,
                "expires_at": "2026-08-01T00:00:00+00:00",
                "created_at": "2026-07-01T00:00:00+00:00",
            },
            {
                "email": "accepted@sitesecure.test",
                "role_key": "technician",
                "accepted_at": "2026-08-10T00:00:00+00:00",
                "expires_at": "2026-08-29T00:00:00+00:00",
                "created_at": "2026-08-02T00:00:00+00:00",
            },
        ],
        now=now,
    )
    meters = {row["key"]: row for row in seat_meters(plan_key="solo", occupants=occupancy.occupants)}
    assert occupancy.pending_invites == 0
    assert meters["seats_field"]["current"] == 0


def test_invite_for_existing_member_does_not_double_count():
    occupancy = occupancy_from_rows(
        members=[
            {
                "role_key": "technician",
                "status": "active",
                "profiles": {"full_name": "Dana", "email": "dana@sitesecure.test"},
            }
        ],
        invites=[
            {
                "email": "dana@sitesecure.test",
                "role_key": "technician",
                "accepted_at": None,
                "expires_at": "2026-08-29T00:00:00+00:00",
                "created_at": "2026-08-15T00:00:00+00:00",
            }
        ],
        now=_FIXTURE_NOW,
    )
    meters = {row["key"]: row for row in seat_meters(plan_key="solo", occupants=occupancy.occupants)}
    assert occupancy.active_members == 1
    assert occupancy.pending_invites == 0
    assert meters["seats_field"]["current"] == 1
    assert meters["seats_field"]["occupants"][0]["kind"] == "member"


def test_disabled_membership_does_not_occupy_a_seat():
    occupancy = occupancy_from_rows(
        members=[{"role_key": "technician", "status": "disabled", "profiles": {"email": "old@sitesecure.test"}}],
        invites=[],
        now=_FIXTURE_NOW,
    )
    assert occupancy.active_members == 0
    assert occupancy.roles == []


def test_two_distinct_technicians_occupy_two_field_seats():
    occupancy = occupancy_from_rows(
        members=[{"role_key": "owner", "status": "active", "profiles": {"email": "owner@sitesecure.test"}}],
        invites=[
            {
                "email": "a@sitesecure.test",
                "role_key": "technician",
                "accepted_at": None,
                "expires_at": "2026-08-29T00:00:00+00:00",
                "created_at": "2026-08-15T00:00:01+00:00",
            },
            {
                "email": "b@sitesecure.test",
                "role_key": "founding_technician",
                "accepted_at": None,
                "expires_at": "2026-08-29T00:00:00+00:00",
                "created_at": "2026-08-15T00:00:02+00:00",
            },
        ],
        now=_FIXTURE_NOW,
    )
    meters = {row["key"]: row for row in seat_meters(plan_key="solo", occupants=occupancy.occupants)}
    assert meters["seats_field"]["current"] == 2
    assert occupancy.pending_invites == 2
