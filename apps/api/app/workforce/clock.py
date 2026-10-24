"""Site-local clock helpers. Assignments stay UTC; templates stay local times."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from .store import DEFAULT_SITE_TIMEZONE, validation

# Postgres DOW / JS getDay: Sunday = 0.
SUNDAY = 0


def parse_dt(value: str | None, label: str) -> datetime:
    raw = (value or "").strip()
    if not raw:
        raise validation(f"{label} חובה")
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        raise validation(f"{label} אינו תקין") from None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def to_iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def site_zone(name: str | None) -> ZoneInfo:
    raw = (name or DEFAULT_SITE_TIMEZONE).strip() or DEFAULT_SITE_TIMEZONE
    try:
        return ZoneInfo(raw)
    except (ZoneInfoNotFoundError, ValueError):
        raise validation("אזור הזמן אינו מוכר") from None


def sunday_index(value: date) -> int:
    return (value.weekday() + 1) % 7


def parse_local_time(value: str | None, label: str) -> time:
    raw = (value or "").strip()
    if not raw:
        raise validation(f"{label} חובה")
    try:
        if len(raw) == 5:
            return time.fromisoformat(raw)
        return time.fromisoformat(raw)
    except ValueError:
        raise validation(f"{label} אינו תקין") from None


def local_window_to_utc(
    *,
    timezone_name: str | None,
    on_date: date,
    start_local: time,
    end_local: time,
    crosses_midnight: bool = False,
) -> tuple[datetime, datetime]:
    tz = site_zone(timezone_name)
    start = datetime.combine(on_date, start_local, tzinfo=tz)
    overnight = crosses_midnight or end_local <= start_local
    end_date = on_date + timedelta(days=1) if overnight else on_date
    end = datetime.combine(end_date, end_local, tzinfo=tz)
    if end <= start:
        raise validation("חלון השעות המקומי אינו תקין")
    return start.astimezone(timezone.utc), end.astimezone(timezone.utc)


def overlaps(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    return a_start < b_end and a_end > b_start


def hours_between(start: datetime, end: datetime) -> float:
    return max((end - start).total_seconds(), 0.0) / 3600.0


def local_week_bounds(moment: datetime, tz: ZoneInfo) -> tuple[datetime, datetime]:
    """Sunday 00:00 site-local through next Sunday 00:00."""
    local = moment.astimezone(tz)
    start_date = local.date() - timedelta(days=sunday_index(local.date()))
    start = datetime.combine(start_date, time.min, tzinfo=tz)
    end = datetime.combine(start_date + timedelta(days=7), time.min, tzinfo=tz)
    return start, end


def split_local_day_hours(starts: datetime, ends: datetime, tz: ZoneInfo) -> list[tuple[date, float]]:
    local_start = starts.astimezone(tz)
    local_end = ends.astimezone(tz)
    pieces: list[tuple[date, float]] = []
    cursor = local_start
    while cursor < local_end:
        nxt = datetime.combine(cursor.date() + timedelta(days=1), time.min, tzinfo=tz)
        piece_end = min(local_end, nxt)
        pieces.append((cursor.date(), hours_between(cursor, piece_end)))
        cursor = piece_end
    return pieces


def split_week_hours(starts: datetime, ends: datetime, tz: ZoneInfo) -> list[tuple[datetime, float]]:
    pieces: list[tuple[datetime, float]] = []
    cursor = starts.astimezone(tz)
    local_end = ends.astimezone(tz)
    while cursor < local_end:
        week_start, week_end = local_week_bounds(cursor, tz)
        piece_end = min(local_end, week_end)
        pieces.append((week_start, hours_between(cursor, piece_end)))
        cursor = piece_end
    return pieces


def night_window_hours(
    starts: datetime,
    ends: datetime,
    tz: ZoneInfo,
    *,
    night_start: time = time(22, 0),
    night_end: time = time(6, 0),
) -> float:
    local_s = starts.astimezone(tz)
    local_e = ends.astimezone(tz)
    total = timedelta(0)
    day = local_s.date() - timedelta(days=1)
    last = local_e.date()
    while day <= last:
        win_s = datetime.combine(day, night_start, tzinfo=tz)
        win_e = datetime.combine(day + timedelta(days=1), night_end, tzinfo=tz)
        overlap_s = max(local_s, win_s)
        overlap_e = min(local_e, win_e)
        if overlap_e > overlap_s:
            total += overlap_e - overlap_s
        day += timedelta(days=1)
    return total.total_seconds() / 3600.0


def is_night_work(starts: datetime, ends: datetime, tz: ZoneInfo, *, min_hours: float = 2.0) -> bool:
    return night_window_hours(starts, ends, tz) + 1e-9 >= min_hours


def weekday_window(week_start: datetime, weekday: int, tz: ZoneInfo) -> tuple[datetime, datetime]:
    day = week_start.astimezone(tz).date() + timedelta(days=int(weekday) % 7)
    start = datetime.combine(day, time.min, tzinfo=tz)
    end = datetime.combine(day + timedelta(days=1), time.min, tzinfo=tz)
    return start, end


def longest_free_gap(
    busy: list[tuple[datetime, datetime]],
    window_start: datetime,
    window_end: datetime,
) -> timedelta:
    clipped: list[tuple[datetime, datetime]] = []
    for start, end in busy:
        lo = max(start, window_start)
        hi = min(end, window_end)
        if hi > lo:
            clipped.append((lo, hi))
    clipped.sort()
    cursor = window_start
    longest = timedelta(0)
    for start, end in clipped:
        if start > cursor:
            longest = max(longest, start - cursor)
        cursor = max(cursor, end)
    if window_end > cursor:
        longest = max(longest, window_end - cursor)
    if not clipped:
        return window_end - window_start
    return longest
