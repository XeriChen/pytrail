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


class LessonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    order: int
    duration: int
    markdown: str
    exercises: list[ExerciseOut] = []


class CourseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    slug: str
    description: str
    level: str
    accent: str
    lessons: list[LessonOut] = []


class ProgressIn(BaseModel):
    lesson_id: int
    completed: bool = True
    score: int = 100


class ExecuteIn(BaseModel):
    code: str


class ExerciseSubmit(BaseModel):
    answer: str
