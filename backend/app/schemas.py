from pydantic import BaseModel, ConfigDict


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
