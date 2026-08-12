"""Learning metrics derived from real progress history."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone


def as_utc_date(value: datetime) -> date:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).date()


def compute_streak(activity_dates: list[date], today: date | None = None) -> int:
    """Consecutive calendar days of activity ending today or yesterday.

    A gap of more than one day from `today` resets the streak to 0. Activity
    yesterday with nothing yet today still counts (the current day is open).
    """
    today = today or datetime.now(timezone.utc).date()
    days = sorted(set(activity_dates), reverse=True)
    if not days:
        return 0
    latest = days[0]
    if latest < today - timedelta(days=1):
        return 0
    streak = 0
    expected = latest
    for day in days:
        if day == expected:
            streak += 1
            expected = expected - timedelta(days=1)
        elif day < expected:
            break
    return streak
