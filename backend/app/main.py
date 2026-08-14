import json
import os
import subprocess
import sys
import mimetypes
from pathlib import Path
from urllib.parse import unquote
from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.orm import Session, load_only, selectinload
from .auth import create_token, current_user, enforce_secret_key_policy, hash_password, optional_current_user, verify_password
from .database import Base, SessionLocal, engine, get_db
from .metrics import as_utc_date, compute_streak
from .models import Course, Exercise, Lesson, Progress, User
from .practice_runner import MAX_SOURCE_BYTES, PracticeCaseInput, PracticeRunError, PracticeRunnerUnavailable, run_practice
from .practice_service import DIFFICULTIES, STATUSES, exercise_detail, get_exercise, list_exercises, record_run
from .ratelimit import auth_limiter, practice_limiter
from .course_sync import ContentSyncError, resolve_content_root, sync_courses
from .schemas import CourseDetailOut, CourseSummaryOut, ExecuteIn, ExerciseOut, ExerciseSubmit, LessonDetailOut, LessonSummaryOut, LoginRequest, PracticeCatalogOut, PracticeDetailOut, PracticeProgressOut, PracticeRunIn, PracticeRunOut, ProgressIn, Token, UserCreate, UserOut


@asynccontextmanager
async def lifespan(_app: FastAPI):
    enforce_secret_key_policy()
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        result = sync_courses(db, resolve_content_root())
        _app.state.content_index = result.index
        yield
    finally:
        db.close()


app = FastAPI(title="PyTrail Learning API", version="1.0.0", lifespan=lifespan)
origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def limit_auth(request: Request) -> None:
    key = f"{request.url.path}:{client_ip(request)}"
    if not auth_limiter.allow(key):
        raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "pytrail-api"}


@app.post("/api/auth/register", response_model=Token, status_code=201)
def register(payload: UserCreate, request: Request, db: Session = Depends(get_db)):
    limit_auth(request)
    if len(payload.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    if db.scalar(select(User).where(User.email == payload.email.lower())):
        raise HTTPException(409, "Email already registered")
    user = User(name=payload.name.strip(), email=payload.email.lower(), password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return Token(access_token=create_token(user.id), user=user)


@app.post("/api/auth/login", response_model=Token)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    limit_auth(request)
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, "Incorrect email or password")
    return Token(access_token=create_token(user.id), user=user)


@app.get("/api/auth/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user


@app.get("/api/courses", response_model=list[CourseSummaryOut])
def courses(db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Course).options(
            selectinload(Course.lessons).load_only(
                Lesson.id,
                Lesson.course_id,
                Lesson.title,
                Lesson.order,
                Lesson.duration,
            )
        )
    ).all()
    index = getattr(app.state, "content_index", None)
    rows.sort(key=lambda row: index.course_order.get(row.slug, row.id) if index else row.id)
    return [CourseSummaryOut(id=row.id, slug=row.slug, title=row.title, description=row.description, level=row.level, accent=row.accent, lesson_count=len(row.lessons), total_duration=sum(lesson.duration for lesson in row.lessons)) for row in rows]


@app.get("/api/courses/{course_id}", response_model=CourseDetailOut)
def course_detail(course_id: int, db: Session = Depends(get_db)):
    lesson_summaries = selectinload(Course.lessons).options(
        load_only(
            Lesson.id,
            Lesson.course_id,
            Lesson.title,
            Lesson.order,
            Lesson.duration,
        ),
        selectinload(Lesson.exercises).load_only(Exercise.id, Exercise.lesson_id, Exercise.kind),
    )
    course = db.scalar(
        select(Course).where(Course.id == course_id).options(lesson_summaries)
    )
    if not course:
        raise HTTPException(404, "Course not found")
    lessons = [
        LessonSummaryOut(
            id=lesson.id,
            title=lesson.title,
            order=lesson.order,
            duration=lesson.duration,
            has_exercises=any(item.kind == "quick_check" for item in lesson.exercises),
            practice_count=sum(item.kind == "function" for item in lesson.exercises),
        )
        for lesson in sorted(course.lessons, key=lambda item: item.order)
    ]
    return CourseDetailOut(id=course.id, slug=course.slug, title=course.title, description=course.description, level=course.level, accent=course.accent, lesson_count=len(lessons), total_duration=sum(item.duration for item in lessons), lessons=lessons)


@app.get("/api/lessons/{lesson_id}", response_model=LessonDetailOut)
def lesson_detail(lesson_id: int, db: Session = Depends(get_db)):
    lesson = db.scalar(select(Lesson).where(Lesson.id == lesson_id).options(selectinload(Lesson.course), selectinload(Lesson.exercises)))
    if not lesson:
        raise HTTPException(404, "Lesson not found")
    index = getattr(app.state, "content_index", None)
    links = index.lesson_links(lesson.id) if index else {}
    quick_checks = [item for item in lesson.exercises if item.kind == "quick_check"]
    return LessonDetailOut(id=lesson.id, title=lesson.title, order=lesson.order, duration=lesson.duration, has_exercises=bool(quick_checks), practice_count=sum(item.kind == "function" for item in lesson.exercises), course_id=lesson.course_id, course_slug=lesson.course.slug, markdown=lesson.markdown, exercises=[ExerciseOut.model_validate(item) for item in quick_checks], asset_base_url=f"/api/course-assets/{lesson.course.slug}/", lesson_links=links)


@app.get("/api/practice/exercises", response_model=PracticeCatalogOut)
def practice_catalog(
    query: str = Query("", max_length=120),
    course: str | None = Query(None, max_length=160),
    lesson_id: int | None = Query(None, gt=0),
    difficulty: str | None = None,
    tag: str | None = Query(None, max_length=80),
    status: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=48),
    user: User | None = Depends(optional_current_user),
    db: Session = Depends(get_db),
):
    if difficulty is not None and difficulty not in DIFFICULTIES:
        raise HTTPException(422, "Invalid difficulty")
    if status is not None:
        if status not in STATUSES:
            raise HTTPException(422, "Invalid status")
        if user is None:
            raise HTTPException(401, "Authentication required for status filtering")
    return list_exercises(db, user, query=query, course=course, lesson_id=lesson_id, difficulty=difficulty, tag=tag, status=status, page=page, page_size=page_size)


@app.get("/api/practice/exercises/{slug}", response_model=PracticeDetailOut)
def practice_exercise_detail(
    slug: str,
    user: User | None = Depends(optional_current_user),
    db: Session = Depends(get_db),
):
    exercise = get_exercise(db, slug)
    if exercise is None:
        raise HTTPException(404, "Practice exercise not found")
    return exercise_detail(db, exercise, user)


@app.post("/api/practice/exercises/{slug}/run", response_model=PracticeRunOut)
def run_practice_exercise(
    slug: str,
    payload: PracticeRunIn,
    request: Request,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    if not practice_limiter.allow(f"{user.id}:{client_ip(request)}"):
        raise HTTPException(429, "Too many practice runs. Try again later.")
    if len(payload.code.encode("utf-8")) > MAX_SOURCE_BYTES:
        raise HTTPException(413, "Code is too long")
    exercise = get_exercise(db, slug)
    if exercise is None:
        raise HTTPException(404, "Practice exercise not found")
    signature = json.loads(exercise.signature_json)
    cases = [
        PracticeCaseInput(
            json.loads(case.args_json),
            json.loads(case.kwargs_json),
            json.loads(case.expected_json),
            case.comparison,
            case.tolerance,
        )
        for case in sorted(exercise.cases, key=lambda item: item.order)
    ]
    try:
        result = run_practice(
            payload.code,
            exercise.function_name or "",
            [item["name"] for item in signature["parameters"]],
            cases,
        )
    except PracticeRunError as exc:
        result = {"ok": False, "passed": False, "passed_count": 0, "total_count": len(cases), "error": str(exc), "cases": []}
    except (OSError, PracticeRunnerUnavailable) as exc:
        raise HTTPException(503, "Practice runner unavailable") from exc
    progress = record_run(db, user, exercise, payload.code, bool(result["passed"]))
    result["progress"] = PracticeProgressOut.model_validate(progress, from_attributes=True)
    return result


@app.get("/api/course-assets/{course_slug}/{asset_path:path}")
def course_asset(course_slug: str, asset_path: str):
    index = getattr(app.state, "content_index", None)
    if index is None:
        raise HTTPException(404, "Asset not found")
    try:
        root = index.asset_root(course_slug).resolve()
    except ContentSyncError as exc:
        raise HTTPException(404, "Asset not found") from exc
    decoded = unquote(asset_path).replace("\\", "/")
    parts = Path(decoded).parts
    if not decoded or "\x00" in decoded or not parts or parts[0] != "res":
        raise HTTPException(404, "Asset not found")
    candidate = root.joinpath(*parts[1:]).resolve()
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise HTTPException(404, "Asset not found") from exc
    if not candidate.is_file():
        raise HTTPException(404, "Asset not found")
    return FileResponse(candidate, media_type=mimetypes.guess_type(candidate.name)[0] or "application/octet-stream")


@app.get("/api/dashboard")
def dashboard(user: User = Depends(current_user), db: Session = Depends(get_db)):
    total = db.scalar(select(func.count(Lesson.id))) or 0
    completed = db.scalar(select(func.count(Progress.id)).where(Progress.user_id == user.id, Progress.completed.is_(True))) or 0
    avg_score = db.scalar(select(func.avg(Progress.score)).where(Progress.user_id == user.id)) or 0
    stamps = db.scalars(
        select(Progress.updated_at).where(Progress.user_id == user.id, Progress.completed.is_(True))
    ).all()
    streak = compute_streak([as_utc_date(stamp) for stamp in stamps if stamp])
    return {"lessons_total": total, "lessons_completed": completed, "completion": round((completed / total) * 100) if total else 0, "average_score": round(avg_score), "streak": streak}


@app.post("/api/progress")
def update_progress(payload: ProgressIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    progress = db.scalar(select(Progress).where(Progress.user_id == user.id, Progress.lesson_id == payload.lesson_id))
    if not progress:
        progress = Progress(user_id=user.id, lesson_id=payload.lesson_id)
        db.add(progress)
    progress.completed = payload.completed
    progress.score = max(0, min(payload.score, 100))
    db.commit()
    return {"ok": True, "lesson_id": payload.lesson_id, "completed": progress.completed}


@app.post("/api/exercises/{exercise_id}/submit")
def submit_exercise(exercise_id: int, payload: ExerciseSubmit, user: User = Depends(current_user), db: Session = Depends(get_db)):
    exercise = db.get(Exercise, exercise_id)
    if not exercise:
        raise HTTPException(404, "Exercise not found")
    if exercise.kind != "quick_check":
        raise HTTPException(404, "Exercise not found")
    correct = payload.answer.strip().lower() == exercise.expected_answer.lower()
    progress = db.scalar(select(Progress).where(Progress.user_id == user.id, Progress.lesson_id == exercise.lesson_id))
    if not progress:
        progress = Progress(user_id=user.id, lesson_id=exercise.lesson_id)
        db.add(progress)
    progress.score = 100 if correct else 40
    progress.completed = correct
    db.commit()
    return {"correct": correct, "score": progress.score, "message": "Nice work!" if correct else "Almost there - review the lesson and try again."}


@app.post("/api/execute")
def execute(payload: ExecuteIn, user: User = Depends(current_user)):
    del user  # auth is required for attribution; the runner does not use the user record
    if len(payload.code) > 4000:
        raise HTTPException(413, "Code is too long")
    try:
        result = subprocess.run([sys.executable, "-I", "-c", payload.code], capture_output=True, text=True, timeout=2, env={"PATH": os.getenv("PATH", "")})
        return {"ok": result.returncode == 0, "stdout": result.stdout[-4000:], "stderr": result.stderr[-4000:]}
    except subprocess.TimeoutExpired:
        return {"ok": False, "stdout": "", "stderr": "Execution timed out after 2 seconds."}
