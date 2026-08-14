from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class UserCreate(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


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
    cases: list[PracticeRunCaseOut]
    progress: PracticeProgressOut | None = None
