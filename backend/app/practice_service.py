"""Queries and progress orchestration for the public practice catalog."""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .course_sync import COURSE_SPECS
from .models import Course, Exercise, ExerciseProgress, Lesson, User
from .schemas import (
    PracticeCaseOut,
    PracticeCatalogOut,
    PracticeCourseOut,
    PracticeDetailOut,
    PracticeExerciseOut,
    PracticeFacetsOut,
    PracticeLessonOut,
    PracticeProgressOut,
    PracticeSignatureOut,
)


DIFFICULTIES = frozenset({"easy", "medium", "hard"})
STATUSES = frozenset({"not_started", "in_progress", "passed"})
COURSE_ORDER = {spec.slug: position for position, spec in enumerate(COURSE_SPECS)}


def _rows(db: Session) -> list[Exercise]:
    rows = list(
        db.scalars(
            select(Exercise)
            .where(Exercise.kind == "function")
            .options(
                selectinload(Exercise.lesson).selectinload(Lesson.course),
                selectinload(Exercise.tags),
                selectinload(Exercise.cases),
            )
        ).unique()
    )
    rows.sort(key=lambda item: (COURSE_ORDER.get(item.lesson.course.slug, 999), item.lesson.order, item.order))
    return rows


def _progress_map(db: Session, user: User | None) -> dict[int, ExerciseProgress]:
    if user is None:
        return {}
    return {
        item.exercise_id: item
        for item in db.scalars(select(ExerciseProgress).where(ExerciseProgress.user_id == user.id))
    }


def _progress_out(progress: ExerciseProgress | None) -> PracticeProgressOut | None:
    return PracticeProgressOut.model_validate(progress, from_attributes=True) if progress else None


def _summary(row: Exercise, progress: ExerciseProgress | None) -> PracticeExerciseOut:
    return PracticeExerciseOut(
        slug=row.slug or "",
        title=row.title,
        difficulty=row.difficulty or "easy",
        tags=sorted(tag.slug for tag in row.tags),
        course=PracticeCourseOut(id=row.lesson.course.id, slug=row.lesson.course.slug, title=row.lesson.course.title),
        lesson=PracticeLessonOut(id=row.lesson.id, title=row.lesson.title, order=row.lesson.order),
        progress=_progress_out(progress),
    )


def list_exercises(
    db: Session,
    user: User | None,
    *,
    query: str = "",
    course: str | None = None,
    lesson_id: int | None = None,
    difficulty: str | None = None,
    tag: str | None = None,
    status: str | None = None,
    page: int = 1,
    page_size: int = 12,
) -> PracticeCatalogOut:
    rows = _rows(db)
    progress = _progress_map(db, user)
    all_rows = rows
    needle = query.strip().casefold()
    if needle:
        rows = [row for row in rows if needle in f"{row.title} {row.prompt}".casefold()]
    if course:
        rows = [row for row in rows if row.lesson.course.slug == course]
    if lesson_id is not None:
        rows = [row for row in rows if row.lesson_id == lesson_id]
    if difficulty:
        rows = [row for row in rows if row.difficulty == difficulty]
    if tag:
        rows = [row for row in rows if any(item.slug == tag for item in row.tags)]
    if status:
        rows = [
            row
            for row in rows
            if (progress[row.id].status if row.id in progress else "not_started") == status
        ]

    total = len(rows)
    start = (page - 1) * page_size
    courses: dict[int, PracticeCourseOut] = {}
    lessons: dict[int, PracticeLessonOut] = {}
    tags: set[str] = set()
    for row in all_rows:
        courses[row.lesson.course.id] = PracticeCourseOut(
            id=row.lesson.course.id, slug=row.lesson.course.slug, title=row.lesson.course.title
        )
        lessons[row.lesson.id] = PracticeLessonOut(id=row.lesson.id, title=row.lesson.title, order=row.lesson.order)
        tags.update(item.slug for item in row.tags)
    return PracticeCatalogOut(
        items=[_summary(row, progress.get(row.id)) for row in rows[start : start + page_size]],
        total=total,
        page=page,
        page_size=page_size,
        facets=PracticeFacetsOut(
            courses=list(courses.values()),
            lessons=list(lessons.values()),
            difficulties=["easy", "medium", "hard"],
            tags=sorted(tags),
        ),
    )


def get_exercise(db: Session, slug: str) -> Exercise | None:
    return db.scalar(
        select(Exercise)
        .where(Exercise.kind == "function", Exercise.slug == slug)
        .options(
            selectinload(Exercise.lesson).selectinload(Lesson.course),
            selectinload(Exercise.tags),
            selectinload(Exercise.cases),
        )
    )


def exercise_detail(db: Session, exercise: Exercise, user: User | None) -> PracticeDetailOut:
    progress = None
    if user is not None:
        progress = db.scalar(
            select(ExerciseProgress).where(
                ExerciseProgress.user_id == user.id,
                ExerciseProgress.exercise_id == exercise.id,
            )
        )
    summary = _summary(exercise, progress)
    signature: dict[str, Any] = json.loads(exercise.signature_json)
    return PracticeDetailOut(
        **summary.model_dump(),
        prompt=exercise.prompt,
        function_name=exercise.function_name or "",
        signature=PracticeSignatureOut.model_validate(signature),
        starter_code=progress.last_code if progress and progress.last_code else exercise.starter_code,
        cases=[
            PracticeCaseOut(
                order=case.order,
                args=json.loads(case.args_json),
                kwargs=json.loads(case.kwargs_json),
                expected=json.loads(case.expected_json),
                explanation=case.explanation,
                comparison=case.comparison,
                tolerance=case.tolerance,
            )
            for case in sorted(exercise.cases, key=lambda item: item.order)
        ],
    )


def record_run(db: Session, user: User, exercise: Exercise, code: str, passed: bool) -> ExerciseProgress:
    progress = db.scalar(
        select(ExerciseProgress).where(
            ExerciseProgress.user_id == user.id,
            ExerciseProgress.exercise_id == exercise.id,
        )
    )
    if progress is None:
        progress = ExerciseProgress(user_id=user.id, exercise_id=exercise.id, attempts=0)
        db.add(progress)
    progress.attempts = (progress.attempts or 0) + 1
    progress.last_code = code
    if passed or progress.status != "passed":
        progress.status = "passed" if passed else "in_progress"
    db.commit()
    db.refresh(progress)
    return progress
