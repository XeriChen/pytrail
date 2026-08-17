from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .activity_service import (
    PRACTICE_PASSED,
    latest_activity_dates,
)
from .activity_service import (
    activity_dates as load_activity_dates,
)
from .metrics import compute_streak
from .models import Exercise, ExerciseProgress, Lesson, Progress, User
from .practice_service import COURSE_ORDER


def build_dashboard(
    db: Session, user: User, *, today: date | None = None
) -> dict[str, object]:
    today = today or datetime.now(UTC).date()
    lessons = list(db.scalars(select(Lesson).options(selectinload(Lesson.course))))
    lessons.sort(key=lambda item: (COURSE_ORDER.get(item.course.slug, 999), item.order))
    lesson_progress = {
        item.lesson_id: item
        for item in db.scalars(select(Progress).where(Progress.user_id == user.id))
    }
    exercises = list(
        db.scalars(
            select(Exercise)
            .where(Exercise.kind == "function")
            .options(selectinload(Exercise.lesson).selectinload(Lesson.course))
        )
    )
    exercises.sort(
        key=lambda item: (
            COURSE_ORDER.get(item.lesson.course.slug, 999),
            item.lesson.order,
            item.order,
        )
    )
    exercise_progress = {
        item.exercise_id: item
        for item in db.scalars(
            select(ExerciseProgress).where(ExerciseProgress.user_id == user.id)
        )
    }
    successful_days = load_activity_dates(db, user.id)
    review_dates = latest_activity_dates(db, user.id, PRACTICE_PASSED)
    total = len(lessons)
    completed = sum(1 for item in lesson_progress.values() if item.completed)
    scores = [item.score for item in lesson_progress.values()]
    recent_cutoff = today - timedelta(days=6)
    recent_activity = sorted(
        day.isoformat() for day in successful_days if recent_cutoff <= day <= today
    )
    return {
        "lessons_total": total,
        "lessons_completed": completed,
        "completion": round((completed / total) * 100) if total else 0,
        "average_score": round(sum(scores) / len(scores)) if scores else 0,
        "streak": compute_streak(list(successful_days), today),
        "today_task": _today_task(
            lessons,
            lesson_progress,
            exercises,
            exercise_progress,
            review_dates,
            today,
        ),
        "recent_activity": recent_activity,
    }


def _today_task(
    lessons: list[Lesson],
    lesson_progress: dict[int, Progress],
    exercises: list[Exercise],
    exercise_progress: dict[int, ExerciseProgress],
    review_dates: dict[str, date],
    today: date,
) -> dict[str, object] | None:
    for exercise in exercises:
        progress = exercise_progress.get(exercise.id)
        if progress is not None and progress.status == "in_progress":
            return _exercise_task(exercise, "resume_practice", False)

    for lesson in lessons:
        progress = lesson_progress.get(lesson.id)
        if progress is None or not progress.completed:
            return _lesson_task(lesson)

    for exercise in exercises:
        if exercise.id not in exercise_progress:
            return _exercise_task(exercise, "start_practice", False)

    passed = [
        exercise
        for exercise in exercises
        if exercise_progress.get(exercise.id) is not None
        and exercise_progress[exercise.id].status == "passed"
    ]
    if not passed:
        return None
    passed.sort(key=lambda exercise: review_dates.get(exercise.slug or "", date.min))
    exercise = passed[0]
    last_success = review_dates.get(exercise.slug or "")
    return _exercise_task(exercise, "review_practice", last_success == today)


def _exercise_task(
    exercise: Exercise, reason_code: str, completed: bool
) -> dict[str, object]:
    return {
        "kind": "practice",
        "slug": exercise.slug,
        "lesson_id": exercise.lesson.id,
        "title": exercise.title,
        "course_slug": exercise.lesson.course.slug,
        "course_title": exercise.lesson.course.title,
        "lesson_title": exercise.lesson.title,
        "reason_code": reason_code,
        "estimated_minutes": 10,
        "completed": completed,
    }


def _lesson_task(lesson: Lesson) -> dict[str, object]:
    return {
        "kind": "lesson",
        "slug": None,
        "lesson_id": lesson.id,
        "title": lesson.title,
        "course_slug": lesson.course.slug,
        "course_title": lesson.course.title,
        "lesson_title": lesson.title,
        "reason_code": "start_lesson",
        "estimated_minutes": lesson.duration,
        "completed": False,
    }
