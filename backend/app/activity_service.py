"""Atomic effective-learning activity records used by dashboard streaks."""

from __future__ import annotations

from datetime import UTC, date, datetime

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from .models import LearningActivity, utc_now

LESSON_COMPLETED = "lesson_completed"
QUICK_CHECK_CORRECT = "quick_check_correct"
PRACTICE_PASSED = "practice_passed"
ACTIVITY_KINDS = frozenset({LESSON_COMPLETED, QUICK_CHECK_CORRECT, PRACTICE_PASSED})


def utc_activity_date(now: datetime | None = None) -> date:
    value = now or utc_now()
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC).date()


def _insert(dialect: str):
    if dialect == "sqlite":
        return sqlite_insert(LearningActivity)
    if dialect == "postgresql":
        return postgresql_insert(LearningActivity)
    raise RuntimeError(f"Unsupported database dialect for learning activity: {dialect}")


def build_activity_insert(
    dialect: str,
    *,
    user_id: int,
    kind: str,
    source_key: str,
    activity_date: date,
):
    if kind not in ACTIVITY_KINDS:
        raise ValueError(f"Unknown learning activity kind: {kind}")
    statement = _insert(dialect).values(
        user_id=user_id,
        activity_date=activity_date,
        kind=kind,
        source_key=source_key,
        created_at=utc_now(),
    )
    return statement.on_conflict_do_nothing(
        index_elements=["user_id", "activity_date", "kind", "source_key"]
    )


def record_activity(
    db: Session,
    *,
    user_id: int,
    kind: str,
    source_key: str,
    activity_date: date | None = None,
) -> None:
    """Record one successful activity without committing the surrounding transaction."""

    normalized_source = source_key.strip()
    if not normalized_source:
        raise ValueError("Learning activity source_key must not be blank")
    db.execute(
        build_activity_insert(
            db.get_bind().dialect.name,
            user_id=user_id,
            kind=kind,
            source_key=normalized_source,
            activity_date=activity_date or utc_activity_date(),
        )
    )


def activity_dates(db: Session, user_id: int) -> set[date]:
    return set(
        db.scalars(
            select(LearningActivity.activity_date)
            .where(LearningActivity.user_id == user_id)
            .distinct()
        )
    )


def latest_activity_dates(db: Session, user_id: int, kind: str) -> dict[str, date]:
    if kind not in ACTIVITY_KINDS:
        raise ValueError(f"Unknown learning activity kind: {kind}")
    rows = db.execute(
        select(
            LearningActivity.source_key,
            func.max(LearningActivity.activity_date),
        )
        .where(
            LearningActivity.user_id == user_id,
            LearningActivity.kind == kind,
        )
        .group_by(LearningActivity.source_key)
    )
    return {source_key: activity_date for source_key, activity_date in rows}
