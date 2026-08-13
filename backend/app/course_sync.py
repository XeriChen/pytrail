from __future__ import annotations

import hashlib
import math
import os
import posixpath
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from urllib.parse import unquote, urlsplit

from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload

from .models import Course, Exercise, Lesson, Progress


class ContentSyncError(RuntimeError):
    pass


@dataclass(frozen=True)
class ExerciseSeed:
    prompt: str
    starter_code: str
    expected_answer: str


@dataclass(frozen=True)
class CourseSpec:
    slug: str
    source_dir: str
    title: str
    description: str
    level: str
    accent: str
    order: int


@dataclass(frozen=True)
class LessonRecord:
    source_path: str
    filename: str
    title: str
    order: int
    duration: int
    markdown: str
    markdown_digest: str
    exercises: tuple[ExerciseSeed, ...]


@dataclass(frozen=True)
class CourseManifest:
    spec: CourseSpec
    lessons: tuple[LessonRecord, ...]
    asset_digest: str


@dataclass(frozen=True)
class ContentIndex:
    content_root: Path
    course_order: dict[str, int]
    course_assets: dict[str, Path]
    lesson_sources: dict[int, str]
    lesson_link_maps: dict[int, dict[str, int]]

    def lesson_links(self, lesson_id: int) -> dict[str, int]:
        return dict(self.lesson_link_maps.get(lesson_id, {}))

    def lesson_source(self, lesson_id: int) -> str:
        try:
            return self.lesson_sources[lesson_id]
        except KeyError as exc:
            raise ContentSyncError(f"Unknown indexed lesson: {lesson_id}") from exc

    def asset_root(self, slug: str) -> Path:
        try:
            return self.course_assets[slug]
        except KeyError as exc:
            raise ContentSyncError(f"Unknown indexed course: {slug}") from exc


@dataclass(frozen=True)
class SyncResult:
    changed: bool
    index: ContentIndex


COURSE_SPECS = (
    CourseSpec("python-foundations", "Day01-20", "Python 基础", "从语法、数据结构到面向对象，建立扎实的 Python 基础。", "beginner", "cinnabar", 1),
    CourseSpec("python-essentials", "Day21-30", "Python 实用工具", "掌握文件、办公文档、图像、通信与正则表达式处理。", "beginner", "jade", 2),
    CourseSpec("python-language-and-linux", "Day31-35", "语言进阶与 Linux", "进阶 Python、Web 前端基础与 Linux 操作系统。", "intermediate", "gold", 3),
    CourseSpec("databases-and-sql", "Day36-45", "数据库与 SQL", "学习关系型数据库、SQL、MySQL 与数据仓库基础。", "intermediate", "cyan", 4),
    CourseSpec("web-development-with-django", "Day46-60", "Django Web 开发", "用 Django 与 DRF 构建、测试并部署 Web 应用。", "intermediate", "cinnabar", 5),
    CourseSpec("web-scraping", "Day61-65", "网络数据采集", "掌握网络请求、HTML 解析、并发、Selenium 与 Scrapy。", "intermediate", "jade", 6),
    CourseSpec("data-analysis", "Day66-80", "数据分析", "使用 NumPy、pandas 与可视化工具开展数据分析。", "intermediate", "gold", 7),
    CourseSpec("machine-learning", "Day81-90", "机器学习", "从经典算法到神经网络与自然语言处理。", "advanced", "cyan", 8),
    CourseSpec("projects-and-production", "Day91-100", "项目与生产实践", "团队协作、容器、性能、测试、部署与商业项目实践。", "advanced", "cinnabar", 9),
)


def _exercise(prompt: str, starter_code: str, expected_answer: str) -> ExerciseSeed:
    return ExerciseSeed(prompt, starter_code, expected_answer)


FOUNDATION_EXERCISES: tuple[tuple[ExerciseSeed, ...], ...] = (
    (_exercise("Which command prints the Python interpreter version?", "# Run this in a terminal, not in Python:\n# python --version\n\nprint('Python is ready')", "python"),),
    (_exercise("Which built-in function writes text to the screen?", "print('hello, world')\nprint('goodbye, world')", "print"),),
    (_exercise("What does `type(3.14).__name__` return?", "a = 100\nb = 3.14\nc = 'hello'\nprint(type(a).__name__)\nprint(type(b).__name__)", "float"),),
    (_exercise("What is the result of `2 ** 3`?", "print(7 // 2)\nprint(7 % 2)\nprint(2 ** 3)", "8"),),
    (_exercise("Which keyword introduces an alternative condition after `if`?", "score = 85\nif score >= 90:\n    print('A')\nelif score >= 80:\n    print('B')\nelse:\n    print('C')", "elif"),),
    (
        _exercise("What is the sum of integers 1 through 100?", "total = 0\nfor i in range(1, 101):\n    total += i\nprint(total)", "5050"),
        _exercise("Which keyword immediately terminates a loop?", "for n in range(10):\n    if n == 3:\n        break\n    print(n)", "break"),
    ),
    (_exercise("The 10th Fibonacci number (1, 1, 2, 3, 5, 8, ...) is what?", "a, b = 0, 1\nfor _ in range(10):\n    a, b = b, a + b\n    print(a)", "55"),),
    (_exercise("For `lst = [10, 20, 30, 40]`, what does `lst[-1]` return?", "lst = [10, 20, 30, 40]\nprint(lst[-1])\nprint(lst[::2])", "40"),),
    (_exercise("What does `[x**2 for x in range(4)]` produce?", "squares = [x**2 for x in range(4)]\nprint(squares)", "[0, 1, 4, 9]"),),
    (_exercise("What is the type of `(100,)` (note the trailing comma)?", "print(type((100,)))\nprint(type((100)))", "tuple"),),
    (_exercise("What does `'hello'.upper()` return?", "print('hello'.upper())\nprint('hello, world'.split())", "HELLO"),),
    (_exercise("Which operator computes the intersection of two sets?", "a = {1, 2, 3, 4}\nb = {3, 4, 5, 6}\nprint(a & b)\nprint(a | b)", "&"),),
    (_exercise("Which method returns a value for a key without raising an error if the key is missing?", "person = {'name': 'Ada', 'age': 25}\nprint(person.get('email'))", "get"),),
    (
        _exercise("Which keyword defines a function in Python?", "def fac(n):\n    result = 1\n    for i in range(2, n + 1):\n        result *= i\n    return result\n\nprint(fac(5))", "def"),
        _exercise("What is the factorial of 5 (i.e. `5!`)?", "# 5 * 4 * 3 * 2 * 1 = ?", "120"),
    ),
    (_exercise("What is the GCD of 12 and 18?", "def gcd(x, y):\n    while y % x != 0:\n        x, y = y % x, x\n    return x\n\nprint(gcd(12, 18))", "6"),),
    (_exercise("What does `list(map(lambda x: x * 2, [1, 2, 3]))` return?", "print(list(map(lambda x: x * 2, [1, 2, 3])))", "[2, 4, 6]"),),
    (_exercise("Which `functools` decorator memoizes a function's results?", "from functools import lru_cache\n\n@lru_cache\ndef fib(n):\n    if n in (1, 2):\n        return 1\n    return fib(n - 1) + fib(n - 2)\n\nprint(fib(10))", "lru_cache"),),
    (_exercise("Which keyword defines a class in Python?", "class Student:\n    def __init__(self, name, age):\n        self.name = name\n        self.age = age\n\ns = Student('Ada', 25)\nprint(s.name)", "class"),),
    (_exercise("Which function calls the parent class's `__init__` method?", "class Person:\n    def __init__(self, name):\n        self.name = name\n\nclass Teacher(Person):\n    def __init__(self, name, course):\n        super().__init__(name)\n        self.course = course\n\nprint(Teacher('Ada', 'Python').name)", "super"),),
    (_exercise("Which magic method overloads the `<` operator?", "from enum import Enum\n\nclass Suite(Enum):\n    SPADE, HEART, CLUB, DIAMOND = range(4)\n\nclass Card:\n    def __init__(self, suite, face):\n        self.suite = suite\n        self.face = face\n    def __repr__(self):\n        return f'{self.suite.name}{self.face}'\n\nprint(Card(Suite.HEART, 13))", "__lt__"),),
)


NUMBER_RE = re.compile(r"^(\d+)(?:[-.]|$)")
TITLE_RE = re.compile(r"^\d+(?:-\d+)?\.(.+)\.md$", re.IGNORECASE)
MARKDOWN_LINK_RE = re.compile(r"(?<!!)\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))")


def resolve_content_root() -> Path:
    configured = os.getenv("COURSE_CONTENT_ROOT")
    if configured:
        return Path(configured).expanduser().resolve()
    return (Path(__file__).resolve().parents[1] / "content" / "python-100-days").resolve()


def lesson_sort_key(path: Path) -> tuple[int, str]:
    match = NUMBER_RE.match(path.name)
    if not match:
        raise ContentSyncError(f"Lesson filename has no leading number: {path}")
    return int(match.group(1)), path.name.casefold()


def reading_duration(markdown: str) -> int:
    characters = len("".join(markdown.split()))
    return min(90, max(5, math.ceil(characters / 500)))


def _title_from_path(path: Path) -> str:
    match = TITLE_RE.match(path.name)
    if not match:
        raise ContentSyncError(f"Lesson filename has an invalid shape: {path}")
    return match.group(1)


def _digest_files(paths: Iterable[Path], root: Path) -> str:
    digest = hashlib.sha256()
    for path in sorted(paths, key=lambda item: item.relative_to(root).as_posix()):
        digest.update(path.relative_to(root).as_posix().encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def build_manifests(
    content_root: Path,
    specs: tuple[CourseSpec, ...] = COURSE_SPECS,
) -> tuple[CourseManifest, ...]:
    root = Path(content_root).resolve()
    manifests: list[CourseManifest] = []
    seen_slugs: set[str] = set()
    seen_sources: set[str] = set()
    for spec in specs:
        if spec.slug in seen_slugs or spec.source_dir in seen_sources:
            raise ContentSyncError(f"Duplicate course identity: {spec.slug} / {spec.source_dir}")
        seen_slugs.add(spec.slug)
        seen_sources.add(spec.source_dir)
        course_dir = root / spec.slug
        if not course_dir.is_dir():
            raise ContentSyncError(f"Missing course directory for {spec.slug}: {course_dir}")
        resource_dir = course_dir / "res"
        if not resource_dir.is_dir():
            raise ContentSyncError(f"Missing resource directory for {spec.slug}: {resource_dir}")
        markdown_paths = sorted(course_dir.glob("*.md"), key=lesson_sort_key)
        if not markdown_paths:
            raise ContentSyncError(f"No Markdown lessons found for {spec.slug}: {course_dir}")
        records: list[LessonRecord] = []
        for sequence, path in enumerate(markdown_paths, start=1):
            try:
                raw = path.read_bytes()
                markdown = raw.decode("utf-8")
            except UnicodeDecodeError as exc:
                raise ContentSyncError(f"Invalid UTF-8 Markdown for {spec.slug}: {path}") from exc
            exercises = FOUNDATION_EXERCISES[sequence - 1] if spec.slug == "python-foundations" and sequence <= len(FOUNDATION_EXERCISES) else ()
            records.append(
                LessonRecord(
                    source_path=f"{spec.source_dir}/{path.name}",
                    filename=path.name,
                    title=_title_from_path(path),
                    order=sequence,
                    duration=reading_duration(markdown),
                    markdown=markdown,
                    markdown_digest=hashlib.sha256(raw).hexdigest(),
                    exercises=exercises,
                )
            )
        asset_files = tuple(path for path in resource_dir.rglob("*") if path.is_file())
        manifests.append(CourseManifest(spec, tuple(records), _digest_files(asset_files, resource_dir)))
    return tuple(manifests)


def _course_rows(db: Session) -> list[Course]:
    return list(
        db.scalars(
            select(Course).options(selectinload(Course.lessons).selectinload(Lesson.exercises))
        ).unique()
    )


def manifest_matches(db: Session, manifests: tuple[CourseManifest, ...]) -> bool:
    rows = _course_rows(db)
    if {row.slug for row in rows} != {manifest.spec.slug for manifest in manifests}:
        return False
    by_slug = {row.slug: row for row in rows}
    for manifest in manifests:
        row = by_slug[manifest.spec.slug]
        if (
            row.title,
            row.description,
            row.level,
            row.accent,
        ) != (
            manifest.spec.title,
            manifest.spec.description,
            manifest.spec.level,
            manifest.spec.accent,
        ):
            return False
        lessons = sorted(row.lessons, key=lambda lesson: lesson.order)
        if len(lessons) != len(manifest.lessons):
            return False
        for lesson, expected in zip(lessons, manifest.lessons, strict=True):
            if (
                lesson.title,
                lesson.order,
                lesson.duration,
                hashlib.sha256(lesson.markdown.encode("utf-8")).hexdigest(),
            ) != (
                expected.title,
                expected.order,
                expected.duration,
                expected.markdown_digest,
            ):
                return False
            exercises = sorted(lesson.exercises, key=lambda exercise: exercise.id)
            actual_exercises = [
                (exercise.prompt, exercise.starter_code, exercise.expected_answer)
                for exercise in exercises
            ]
            expected_exercises = [
                (exercise.prompt, exercise.starter_code, exercise.expected_answer)
                for exercise in expected.exercises
            ]
            if actual_exercises != expected_exercises:
                return False
    return True


def _normalized_lesson_target(source_path: str, target: str) -> str | None:
    parsed = urlsplit(target)
    if parsed.scheme or parsed.netloc or not parsed.path.lower().endswith(".md"):
        return None
    decoded = unquote(parsed.path).replace("\\", "/")
    return posixpath.normpath(posixpath.join(posixpath.dirname(source_path), decoded))


def _lesson_links(markdown: str, source_path: str, ids_by_source: dict[str, int]) -> dict[str, int]:
    links: dict[str, int] = {}
    for match in MARKDOWN_LINK_RE.finditer(markdown):
        raw_target = match.group(1) or match.group(2)
        normalized = _normalized_lesson_target(source_path, raw_target)
        if normalized is not None and normalized in ids_by_source:
            links[raw_target] = ids_by_source[normalized]
    return links


def content_index_from_db(
    db: Session,
    manifests: tuple[CourseManifest, ...],
    content_root: Path,
) -> ContentIndex:
    courses = {course.slug: course for course in _course_rows(db)}
    lesson_sources: dict[int, str] = {}
    markdown_by_id: dict[int, str] = {}
    ids_by_source: dict[str, int] = {}
    for manifest in manifests:
        course = courses.get(manifest.spec.slug)
        if course is None:
            raise ContentSyncError(f"Course missing after synchronization: {manifest.spec.slug}")
        lessons_by_order = {lesson.order: lesson for lesson in course.lessons}
        for record in manifest.lessons:
            lesson = lessons_by_order.get(record.order)
            if lesson is None:
                raise ContentSyncError(f"Lesson missing after synchronization: {record.source_path}")
            lesson_sources[lesson.id] = record.source_path
            markdown_by_id[lesson.id] = record.markdown
            ids_by_source[record.source_path] = lesson.id
    link_maps = {
        lesson_id: _lesson_links(markdown_by_id[lesson_id], source, ids_by_source)
        for lesson_id, source in lesson_sources.items()
    }
    root = Path(content_root).resolve()
    return ContentIndex(
        content_root=root,
        course_order={manifest.spec.slug: manifest.spec.order for manifest in manifests},
        course_assets={manifest.spec.slug: root / manifest.spec.slug / "res" for manifest in manifests},
        lesson_sources=lesson_sources,
        lesson_link_maps=link_maps,
    )


def sync_courses(
    db: Session,
    content_root: Path | None = None,
    specs: tuple[CourseSpec, ...] = COURSE_SPECS,
) -> SyncResult:
    root = Path(content_root or resolve_content_root()).resolve()
    manifests = build_manifests(root, specs)
    if manifest_matches(db, manifests):
        return SyncResult(False, content_index_from_db(db, manifests, root))
    try:
        db.execute(delete(Progress))
        db.execute(delete(Exercise))
        db.execute(delete(Lesson))
        db.execute(delete(Course))
        db.flush()
        for manifest in manifests:
            course = Course(
                title=manifest.spec.title,
                slug=manifest.spec.slug,
                description=manifest.spec.description,
                level=manifest.spec.level,
                accent=manifest.spec.accent,
            )
            for record in manifest.lessons:
                lesson = Lesson(
                    course=course,
                    title=record.title,
                    order=record.order,
                    duration=record.duration,
                    markdown=record.markdown,
                )
                lesson.exercises = [
                    Exercise(
                        lesson=lesson,
                        prompt=seed.prompt,
                        starter_code=seed.starter_code,
                        expected_answer=seed.expected_answer,
                    )
                    for seed in record.exercises
                ]
            db.add(course)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return SyncResult(True, content_index_from_db(db, manifests, root))
