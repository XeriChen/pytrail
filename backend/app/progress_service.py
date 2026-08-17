"""Atomic lesson progress upserts shared by the course reader and quick checks."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from .models import Progress, utc_now


def _insert(dialect: str):
    if dialect == "sqlite":
        return sqlite_insert(Progress)
    if dialect == "postgresql":
        return postgresql_insert(Progress)
    raise RuntimeError(f"Unsupported database dialect for lesson progress: {dialect}")


def build_progress_upsert(
    dialect: str, *, user_id: int, lesson_id: int, completed: bool, score: int
):
    statement = _insert(dialect)
    statement = statement.values(
        user_id=user_id,
        lesson_id=lesson_id,
        completed=completed,
        score=score,
        updated_at=utc_now(),
    )
    return statement.on_conflict_do_update(
        index_elements=["user_id", "lesson_id"],
        set_={
            "completed": statement.excluded.completed,
            "score": statement.excluded.score,
            "updated_at": statement.excluded.updated_at,
        },
    )


def upsert_lesson_progress(
    db: Session, *, user_id: int, lesson_id: int, completed: bool, score: int
) -> Progress:
    """Insert or update the user's lesson progress in a single atomic statement.

    Concurrent first writes are safe: the dialect-specific ON CONFLICT clause
    turns the losing INSERT into an UPDATE instead of a unique-violation 500.
    """
    statement = build_progress_upsert(
        db.get_bind().dialect.name,
        user_id=user_id,
        lesson_id=lesson_id,
        completed=completed,
        score=score,
    )
    db.execute(statement)
    db.commit()
    progress = db.scalar(
        select(Progress).where(
            Progress.user_id == user_id,
            Progress.lesson_id == lesson_id,
        )
    )
    if progress is None:
        raise RuntimeError("Lesson progress was not persisted")
    return progress
