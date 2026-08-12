import os
import subprocess
import sys
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload
from .auth import create_token, current_user, hash_password, verify_password
from .database import Base, engine, get_db
from .models import Course, Exercise, Lesson, Progress, User
from .schemas import CourseOut, ExecuteIn, ExerciseSubmit, LoginRequest, ProgressIn, Token, UserCreate, UserOut

app = FastAPI(title="PyTrail Learning API", version="1.0.0")
origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


def seed(db: Session):
    if db.scalar(select(Course.id).limit(1)):
        return
    course = Course(title="Python Foundations", slug="python-foundations", level="Beginner", accent="cyan", description="Build a confident Python foundation through short, practical lessons.")
    lessons = [
        Lesson(title="Variables & data types", order=1, duration=12, markdown="# Variables & data types\n\nPython keeps data readable. Learn how names point to values, then use strings, numbers, and booleans to model your ideas.\n\n```python\nname = \"Ada\"\nprint(f\"Hello, {name}!\")\n```"),
        Lesson(title="Control flow", order=2, duration=15, markdown="# Control flow\n\nMake decisions with `if`, `elif`, and `else`. Repeat work with `for` and `while` loops."),
        Lesson(title="Functions", order=3, duration=18, markdown="# Functions\n\nPackage repeatable logic into small, testable functions with clear inputs and outputs."),
        Lesson(title="Collections", order=4, duration=20, markdown="# Collections\n\nChoose between lists, dictionaries, tuples, and sets to represent structured data."),
    ]
    lessons[0].exercises = [Exercise(prompt="What does `type(3.14).__name__` return?", starter_code="# type your answer in the box below", expected_answer="float")]
    lessons[1].exercises = [Exercise(prompt="Which keyword starts a conditional branch?", starter_code="# type your answer in the box below", expected_answer="if")]
    course.lessons = lessons
    db.add(course)
    db.commit()


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    with next(get_db()) as db:
        seed(db)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "pytrail-api"}


@app.post("/api/auth/register", response_model=Token, status_code=201)
def register(payload: UserCreate, db: Session = Depends(get_db)):
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
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, "Incorrect email or password")
    return Token(access_token=create_token(user.id), user=user)


@app.get("/api/auth/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user


@app.get("/api/courses", response_model=list[CourseOut])
def courses(db: Session = Depends(get_db)):
    return db.scalars(select(Course).options(selectinload(Course.lessons).selectinload(Lesson.exercises))).all()


@app.get("/api/courses/{course_id}", response_model=CourseOut)
def course_detail(course_id: int, db: Session = Depends(get_db)):
    course = db.scalar(select(Course).where(Course.id == course_id).options(selectinload(Course.lessons).selectinload(Lesson.exercises)))
    if not course:
        raise HTTPException(404, "Course not found")
    return course


@app.get("/api/dashboard")
def dashboard(user: User = Depends(current_user), db: Session = Depends(get_db)):
    total = db.scalar(select(func.count(Lesson.id))) or 0
    completed = db.scalar(select(func.count(Progress.id)).where(Progress.user_id == user.id, Progress.completed.is_(True))) or 0
    avg_score = db.scalar(select(func.avg(Progress.score)).where(Progress.user_id == user.id)) or 0
    return {"lessons_total": total, "lessons_completed": completed, "completion": round((completed / total) * 100) if total else 0, "average_score": round(avg_score), "streak": 4}


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
def execute(payload: ExecuteIn):
    if len(payload.code) > 4000:
        raise HTTPException(413, "Code is too long")
    try:
        result = subprocess.run([sys.executable, "-I", "-c", payload.code], capture_output=True, text=True, timeout=2, env={"PATH": os.getenv("PATH", "")})
        return {"ok": result.returncode == 0, "stdout": result.stdout[-4000:], "stderr": result.stderr[-4000:]}
    except subprocess.TimeoutExpired:
        return {"ok": False, "stdout": "", "stderr": "Execution timed out after 2 seconds."}
