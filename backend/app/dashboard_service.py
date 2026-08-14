from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .metrics import as_utc_date, compute_streak
from .models import Exercise, ExerciseProgress, Lesson, Progress, User
from .practice_service import COURSE_ORDER


def build_dashboard(db: Session, user: User) -> dict[str, object]:
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
            .options(
                selectinload(Exercise.lesson).selectinload(Lesson.course),
                selectinload(Exercise.tags),
            )
        ).unique()
    )
    exercises.sort(key=lambda item: (COURSE_ORDER.get(item.lesson.course.slug, 999), item.lesson.order, item.order))
    exercise_progress = {
        item.exercise_id: item
        for item in db.scalars(select(ExerciseProgress).where(ExerciseProgress.user_id == user.id))
    }
    total = len(lessons)
    completed = sum(1 for item in lesson_progress.values() if item.completed)
    scores = [item.score for item in lesson_progress.values()]
    activity_dates = [
        as_utc_date(item.updated_at)
        for item in lesson_progress.values()
        if item.completed and item.updated_at
    ]
    activity_dates.extend(
        as_utc_date(item.updated_at)
        for item in exercise_progress.values()
        if item.status == "passed" and item.updated_at
    )
    today = datetime.now(timezone.utc).date()
    recent_activity = [
        (today - timedelta(days=offset)).isoformat()
        for offset in range(6, -1, -1)
        if today - timedelta(days=offset) in set(activity_dates)
    ]
    return {
        "lessons_total": total,
        "lessons_completed": completed,
        "completion": round((completed / total) * 100) if total else 0,
        "average_score": round(sum(scores) / len(scores)) if scores else 0,
        "streak": compute_streak(activity_dates, today),
        "today_task": _today_task(lessons, lesson_progress, exercises, exercise_progress, today),
        "recent_activity": recent_activity,
    }


def _today_task(
    lessons: list[Lesson],
    lesson_progress: dict[int, Progress],
    exercises: list[Exercise],
    exercise_progress: dict[int, ExerciseProgress],
    today: date,
) -> dict[str, object] | None:
    for exercise in exercises:
        progress = exercise_progress.get(exercise.id)
        if progress is not None and progress.status != "passed":
            return _exercise_task(exercise, "继续完成上次未通过的练习", "resume_practice", progress, today)

    for lesson in lessons:
        progress = lesson_progress.get(lesson.id)
        if progress is None or not progress.completed:
            return _lesson_task(lesson, "开始下一课，建立今天的学习节奏", "start_lesson", progress, today)

    passed = [
        exercise
        for exercise in exercises
        if exercise_progress.get(exercise.id) is not None and exercise_progress[exercise.id].status == "passed"
    ]
    if passed:
        passed.sort(key=lambda exercise: _timestamp(exercise_progress[exercise.id].updated_at))
        exercise = passed[0]
        return _exercise_task(exercise, "复习较早完成的知识点", "review_practice", exercise_progress[exercise.id], today)
    return None


def _timestamp(value: datetime | None) -> float:
    if value is None:
        return float('-inf')
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.timestamp()


def _exercise_task(
    exercise: Exercise,
    reason: str,
    reason_code: str,
    progress: ExerciseProgress,
    today: date,
) -> dict[str, object]:
    updated = as_utc_date(progress.updated_at) if progress.updated_at else None
    return {
        "kind": "practice",
        "slug": exercise.slug,
        "lesson_id": exercise.lesson.id,
        "title": exercise.title,
        "course_title": exercise.lesson.course.title,
        "lesson_title": exercise.lesson.title,
        "reason": reason,
        "reason_code": reason_code,
        "estimated_minutes": 10,
        "completed": progress.status == "passed" and updated == today,
    }


def _lesson_task(
    lesson: Lesson,
    reason: str,
    reason_code: str,
    progress: Progress | None,
    today: date,
) -> dict[str, object]:
    updated = as_utc_date(progress.updated_at) if progress and progress.updated_at else None
    return {
        "kind": "lesson",
        "lesson_id": lesson.id,
        "title": lesson.title,
        "course_title": lesson.course.title,
        "lesson_title": lesson.title,
        "reason": reason,
        "reason_code": reason_code,
        "estimated_minutes": lesson.duration,
        "completed": bool(progress and progress.completed and updated == today),
    }
