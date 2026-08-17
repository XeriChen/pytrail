from datetime import UTC, datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    email: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(256))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    progresses: Mapped[list[Progress]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    exercise_progresses: Mapped[list[ExerciseProgress]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Course(Base):
    __tablename__ = "courses"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(160))
    slug: Mapped[str] = mapped_column(String(160), unique=True)
    description: Mapped[str] = mapped_column(Text)
    level: Mapped[str] = mapped_column(String(30), default="Beginner")
    accent: Mapped[str] = mapped_column(String(20), default="cyan")
    lessons: Mapped[list[Lesson]] = relationship(
        back_populates="course", cascade="all, delete-orphan", order_by="Lesson.order"
    )


class Lesson(Base):
    __tablename__ = "lessons"
    __table_args__ = (
        Index("ux_lessons_course_source_path", "course_id", "source_path", unique=True),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"))
    source_path: Mapped[str | None] = mapped_column(
        String(512), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(160))
    order: Mapped[int] = mapped_column(Integer)
    duration: Mapped[int] = mapped_column(Integer, default=8)
    markdown: Mapped[str] = mapped_column(Text)
    course: Mapped[Course] = relationship(back_populates="lessons")
    exercises: Mapped[list[Exercise]] = relationship(
        back_populates="lesson", cascade="all, delete-orphan", order_by="Exercise.id"
    )


class Exercise(Base):
    __tablename__ = "exercises"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lesson_id: Mapped[int] = mapped_column(ForeignKey("lessons.id"))
    slug: Mapped[str | None] = mapped_column(
        String(180), unique=True, index=True, nullable=True
    )
    kind: Mapped[str] = mapped_column(String(24), default="quick_check", index=True)
    title: Mapped[str] = mapped_column(String(180), default="")
    difficulty: Mapped[str | None] = mapped_column(String(20), nullable=True)
    function_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    signature_json: Mapped[str] = mapped_column(Text, default="{}")
    order: Mapped[int] = mapped_column(Integer, default=1)
    prompt: Mapped[str] = mapped_column(Text)
    starter_code: Mapped[str] = mapped_column(Text, default="")
    expected_answer: Mapped[str] = mapped_column(String(160), default="")
    lesson: Mapped[Lesson] = relationship(back_populates="exercises")
    cases: Mapped[list[ExerciseCase]] = relationship(
        back_populates="exercise",
        cascade="all, delete-orphan",
        order_by="ExerciseCase.order",
    )
    tags: Mapped[list[Tag]] = relationship(
        secondary="exercise_tags", back_populates="exercises"
    )
    progresses: Mapped[list[ExerciseProgress]] = relationship(
        back_populates="exercise", cascade="all, delete-orphan"
    )


class ExerciseCase(Base):
    __tablename__ = "exercise_cases"
    __table_args__ = (
        UniqueConstraint("exercise_id", "order", name="uq_exercise_case_order"),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    exercise_id: Mapped[int] = mapped_column(
        ForeignKey("exercises.id", ondelete="CASCADE"), index=True
    )
    order: Mapped[int] = mapped_column(Integer)
    args_json: Mapped[str] = mapped_column(Text)
    kwargs_json: Mapped[str] = mapped_column(Text, default="{}")
    expected_json: Mapped[str] = mapped_column(Text)
    explanation: Mapped[str] = mapped_column(Text, default="")
    comparison: Mapped[str] = mapped_column(String(20), default="exact")
    tolerance: Mapped[float] = mapped_column(Float, default=1e-6)
    exercise: Mapped[Exercise] = relationship(back_populates="cases")


exercise_tags = Table(
    "exercise_tags",
    Base.metadata,
    Column(
        "exercise_id", ForeignKey("exercises.id", ondelete="CASCADE"), primary_key=True
    ),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Tag(Base):
    __tablename__ = "tags"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    label_zh: Mapped[str] = mapped_column(String(80))
    label_en: Mapped[str] = mapped_column(String(80))
    exercises: Mapped[list[Exercise]] = relationship(
        secondary=exercise_tags, back_populates="tags"
    )


class ExerciseProgress(Base):
    __tablename__ = "exercise_progress"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "exercise_id", name="uq_exercise_progress_user_exercise"
        ),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    exercise_id: Mapped[int] = mapped_column(
        ForeignKey("exercises.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[str] = mapped_column(String(20), default="in_progress")
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    last_code: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )
    user: Mapped[User] = relationship(back_populates="exercise_progresses")
    exercise: Mapped[Exercise] = relationship(back_populates="progresses")


class Progress(Base):
    __tablename__ = "progress"
    __table_args__ = (
        UniqueConstraint("user_id", "lesson_id", name="uq_progress_user_lesson"),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    lesson_id: Mapped[int] = mapped_column(ForeignKey("lessons.id"))
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    score: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )
    user: Mapped[User] = relationship(back_populates="progresses")
