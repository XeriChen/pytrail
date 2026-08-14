from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: str = Field(min_length=3, max_length=160)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Name must not be blank")
        return stripped

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=160)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ExerciseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    prompt: str
    starter_code: str


class LessonSummaryOut(BaseModel):
    id: int
    title: str
    order: int
    duration: int
    has_exercises: bool
    practice_count: int = 0


class CourseSummaryOut(BaseModel):
    id: int
    slug: str
    title: str
    description: str
    level: str
    accent: str
    lesson_count: int
    total_duration: int


class CourseDetailOut(CourseSummaryOut):
    lessons: list[LessonSummaryOut]


class TodayTaskOut(BaseModel):
    kind: Literal["lesson", "practice"]
    slug: str | None = None
    lesson_id: int
    title: str
    course_title: str
    lesson_title: str
    reason: str
    reason_code: Literal["resume_practice", "start_lesson", "review_practice"]
    estimated_minutes: int
    completed: bool


class DashboardOut(BaseModel):
    lessons_total: int
    lessons_completed: int
    completion: int
    average_score: int
    streak: int
    today_task: TodayTaskOut | None = None
    recent_activity: list[str] = Field(default_factory=list)


class LessonDetailOut(LessonSummaryOut):
    course_id: int
    course_slug: str
    markdown: str
    exercises: list[ExerciseOut]
    asset_base_url: str
    lesson_links: dict[str, int]



class ProgressIn(BaseModel):
    lesson_id: int
    completed: bool = True
    score: int = 100


class ExecuteIn(BaseModel):
    code: str


class ExerciseSubmit(BaseModel):
    answer: str


class PracticeProgressOut(BaseModel):
    status: Literal["in_progress", "passed"]
    attempts: int
    last_code: str
    updated_at: datetime


class PracticeCourseOut(BaseModel):
    id: int
    slug: str
    title: str


class PracticeLessonOut(BaseModel):
    id: int
    title: str
    order: int


class PracticeExerciseOut(BaseModel):
    slug: str
    title: str
    difficulty: Literal["easy", "medium", "hard"]
    tags: list[str]
    course: PracticeCourseOut
    lesson: PracticeLessonOut
    progress: PracticeProgressOut | None = None


class PracticeFacetsOut(BaseModel):
    courses: list[PracticeCourseOut]
    lessons: list[PracticeLessonOut]
    difficulties: list[str]
    tags: list[str]


class PracticeCatalogOut(BaseModel):
    items: list[PracticeExerciseOut]
    total: int
    page: int
    page_size: int
    facets: PracticeFacetsOut


class PracticeSignatureParameterOut(BaseModel):
    name: str
    type: str


class PracticeSignatureOut(BaseModel):
    parameters: list[PracticeSignatureParameterOut]
    returns: str


class PracticeCaseOut(BaseModel):
    order: int
    args: list[Any]
    kwargs: dict[str, Any]
    expected: Any
    explanation: str
    comparison: str
    tolerance: float


class PracticeDetailOut(PracticeExerciseOut):
    prompt: str
    function_name: str
    signature: PracticeSignatureOut
    starter_code: str
    hints: list[str] = Field(default_factory=list)
    cases: list[PracticeCaseOut]


class PracticeRunIn(BaseModel):
    code: str = Field(min_length=1)


class PracticeRunCaseOut(BaseModel):
    order: int
    passed: bool
    expected: Any | None = None
    actual: Any | None = None
    error: str | None = None
    duration_ms: float = 0


class PracticeRunOut(BaseModel):
    ok: bool
    passed: bool
    passed_count: int
    total_count: int
    error: str | None
    feedback_category: Literal["all_passed", "wrong_output", "runtime_error", "validation_error"]
    cases: list[PracticeRunCaseOut]
    progress: PracticeProgressOut | None = None
