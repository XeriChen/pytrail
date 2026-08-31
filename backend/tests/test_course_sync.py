from __future__ import annotations

import json
import shutil
import tempfile
import unittest
from datetime import date
from pathlib import Path

from sqlalchemy import create_engine, event, func, select
from sqlalchemy.orm import Session

from app.course_sync import (
    COURSE_SPECS,
    ContentSyncError,
    CourseSpec,
    build_manifests,
    reading_duration,
    sync_courses,
)
from app.database import Base
from app.models import (
    Course,
    Exercise,
    ExerciseCase,
    ExerciseProgress,
    LearningActivity,
    Lesson,
    Progress,
    User,
)
from app.practice_manifest import EXERCISE_COUNTS

CONTENT_ROOT = Path(__file__).resolve().parents[1] / "content" / "python-100-days"


class CourseManifestTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.manifests = build_manifests(CONTENT_ROOT)

    def test_catalog_has_exact_course_and_lesson_counts(self) -> None:
        self.assertEqual(len(COURSE_SPECS), 9)
        self.assertEqual(len(self.manifests), 9)
        self.assertEqual(
            [len(item.lessons) for item in self.manifests],
            [20, 10, 3, 10, 15, 9, 15, 10, 10],
        )
        self.assertEqual(sum(len(item.lessons) for item in self.manifests), 102)

    def test_special_numbering_is_preserved_and_naturally_sorted(self) -> None:
        language = self.manifests[2]
        self.assertEqual(
            [item.filename for item in language.lessons],
            [
                "31.Python语言进阶.md",
                "32-33.Web前端入门.md",
                "34-35.玩转Linux操作系统.md",
            ],
        )
        scraping = self.manifests[5]
        numbered = [
            item.filename
            for item in scraping.lessons
            if item.filename.startswith(("62.", "63."))
        ]
        self.assertEqual(len(numbered), 6)
        self.assertEqual(self.manifests[-1].lessons[-1].filename, "100.补充内容.md")
        self.assertEqual(self.manifests[-1].lessons[-1].title, "补充内容")

    def test_markdown_duration_assets_and_exercises_are_complete(self) -> None:
        lessons = [lesson for course in self.manifests for lesson in course.lessons]
        self.assertTrue(all(5 <= lesson.duration <= 90 for lesson in lessons))
        self.assertIn(
            "初识Python", self.manifests[0].lessons[0].markdown.splitlines()[0]
        )
        self.assertTrue(
            all(len(course.asset_digest) == 64 for course in self.manifests)
        )
        exercises = [exercise for lesson in lessons for exercise in lesson.exercises]
        self.assertEqual(
            sum(exercise.kind == "quick_check" for exercise in exercises), 22
        )
        self.assertEqual(sum(exercise.kind == "function" for exercise in exercises), 40)
        self.assertTrue(
            all(
                sum(
                    exercise.kind == "function"
                    for lesson in course.lessons
                    for exercise in lesson.exercises
                )
                == EXERCISE_COUNTS[course.spec.slug]
                for course in self.manifests
            )
        )
        self.assertFalse(
            any((CONTENT_ROOT / spec.slug / "code").exists() for spec in COURSE_SPECS)
        )

    def test_reading_duration_clamps_to_bounds(self) -> None:
        self.assertEqual(reading_duration("short"), 5)
        self.assertEqual(reading_duration("x" * 3000), 6)
        self.assertEqual(reading_duration("x" * 100000), 90)


class CourseSyncTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name) / "content"
        self.root.mkdir()
        self.practice_root = Path(self.temp_dir.name) / "practice"
        self.practice_root.mkdir()
        self.specs = (
            CourseSpec(
                "fixture-one", "Day01-20", "Fixture One", "First", "beginner", "jade", 1
            ),
            CourseSpec(
                "fixture-two",
                "Day21-30",
                "Fixture Two",
                "Second",
                "intermediate",
                "gold",
                2,
            ),
        )
        self._write_course(
            "fixture-one",
            "01.第一课.md",
            "# 第一课\n\n[下一课](../Day21-30/02.第二课.md)\n",
        )
        self._write_course("fixture-two", "02.第二课.md", "# 第二课\n")
        self._write_practice_manifest("fixture-one", "Day01-20/01.第一课.md")
        self._write_practice_manifest("fixture-two", "Day21-30/02.第二课.md")
        self.engine = create_engine(
            f"sqlite:///{(Path(self.temp_dir.name) / 'test.db').as_posix()}"
        )
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()
        self.temp_dir.cleanup()

    def _write_course(self, slug: str, filename: str, markdown: str) -> None:
        directory = self.root / slug
        (directory / "res").mkdir(parents=True, exist_ok=True)
        (directory / filename).write_text(markdown, encoding="utf-8")
        (directory / "res" / "pixel.png").write_bytes(b"png")

    def _write_practice_manifest(
        self, course_slug: str, lesson_source_path: str, prompt_suffix: str = ""
    ) -> None:
        exercises = []
        for position in range(1, 5):
            exercises.append(
                {
                    "slug": f"{course_slug}-exercise-{position}",
                    "lesson_source_path": lesson_source_path,
                    "title": f"Fixture exercise {position}",
                    "difficulty": "easy",
                    "tags": ["fixtures"],
                    "prompt": f"Return the value. {prompt_suffix}".strip(),
                    "function_name": f"solve_{position}",
                    "signature": {
                        "parameters": [{"name": "value", "type": "int"}],
                        "returns": "int",
                    },
                    "starter_code": f"def solve_{position}(value: int) -> int:\n    return value\n",
                    "hints": [
                        "Read the input.",
                        "Return the value.",
                        "Use return value.",
                    ],
                    "cases": [
                        {"args": [1], "expected": 1},
                        {"args": [0], "expected": 0},
                    ],
                }
            )
        (self.practice_root / f"{course_slug}.json").write_text(
            json.dumps({"course_slug": course_slug, "exercises": exercises}),
            encoding="utf-8",
        )

    def _add_user(self) -> User:
        user = User(name="Ada", email="ada@example.com", password_hash="hash")
        self.db.add(user)
        self.db.commit()
        return user

    def test_first_sync_preserves_users_and_builds_link_index(self) -> None:
        user = self._add_user()
        result = sync_courses(self.db, self.root, self.specs, self.practice_root)
        self.assertTrue(result.changed)
        self.assertEqual(self.db.scalar(select(func.count(Course.id))), 2)
        self.assertEqual(self.db.scalar(select(func.count(Lesson.id))), 2)
        self.assertEqual(
            self.db.scalar(
                select(func.count(Exercise.id)).where(Exercise.kind == "function")
            ),
            8,
        )
        self.assertEqual(self.db.scalar(select(func.count(ExerciseCase.id))), 16)
        self.assertIsNotNone(self.db.get(User, user.id))
        first = self.db.scalar(select(Lesson).where(Lesson.title == "第一课"))
        second = self.db.scalar(select(Lesson).where(Lesson.title == "第二课"))
        self.assertEqual(
            result.index.lesson_links(first.id), {"../Day21-30/02.第二课.md": second.id}
        )

    def test_second_sync_preserves_ids_and_progress(self) -> None:
        user = self._add_user()
        first = sync_courses(self.db, self.root, self.specs, self.practice_root)
        lesson = self.db.scalar(select(Lesson).order_by(Lesson.id))
        ids = list(self.db.scalars(select(Course.id).order_by(Course.id)))
        self.db.add(
            Progress(user_id=user.id, lesson_id=lesson.id, completed=True, score=100)
        )
        self.db.commit()
        second = sync_courses(self.db, self.root, self.specs, self.practice_root)
        self.assertTrue(first.changed)
        self.assertFalse(second.changed)
        self.assertEqual(
            list(self.db.scalars(select(Course.id).order_by(Course.id))), ids
        )
        self.assertEqual(self.db.scalar(select(func.count(Progress.id))), 1)

    def test_changed_markdown_rebuilds_catalog_and_clears_progress(self) -> None:
        user = self._add_user()
        sync_courses(self.db, self.root, self.specs, self.practice_root)
        lesson = self.db.scalar(select(Lesson).order_by(Lesson.id))
        self.db.add(
            Progress(user_id=user.id, lesson_id=lesson.id, completed=True, score=80)
        )
        self.db.add(
            LearningActivity(
                user_id=user.id,
                activity_date=date.today(),
                kind="lesson_completed",
                source_key=lesson.source_path,
            )
        )
        self.db.commit()
        path = self.root / "fixture-one" / "01.第一课.md"
        path.write_text(
            path.read_text(encoding="utf-8") + "\n内容变化。\n", encoding="utf-8"
        )
        result = sync_courses(self.db, self.root, self.specs, self.practice_root)
        self.assertTrue(result.changed)
        self.assertEqual(self.db.scalar(select(func.count(Progress.id))), 0)
        self.assertEqual(self.db.scalar(select(func.count(LearningActivity.id))), 0)
        self.assertIn(
            "内容变化",
            self.db.scalar(select(Lesson.markdown).where(Lesson.title == "第一课")),
        )
        self.assertIsNotNone(self.db.get(User, user.id))

    def test_changed_exercise_rebuilds_catalog_and_clears_practice_progress(
        self,
    ) -> None:
        user = self._add_user()
        sync_courses(self.db, self.root, self.specs, self.practice_root)
        exercise = self.db.scalar(
            select(Exercise).where(Exercise.slug == "fixture-one-exercise-1")
        )
        self.db.add(
            ExerciseProgress(
                user_id=user.id,
                exercise_id=exercise.id,
                status="passed",
                attempts=3,
                last_code="def solve_1(value): return value",
            )
        )
        self.db.commit()

        self._write_practice_manifest(
            "fixture-one", "Day01-20/01.第一课.md", "Changed prompt"
        )
        result = sync_courses(self.db, self.root, self.specs, self.practice_root)

        self.assertTrue(result.changed)
        updated = self.db.scalar(
            select(Exercise).where(Exercise.slug == "fixture-one-exercise-1")
        )
        self.assertIn("Changed prompt", updated.prompt)
        self.assertEqual(self.db.scalar(select(func.count(ExerciseProgress.id))), 0)
        self.assertIsNotNone(self.db.get(User, user.id))

    def test_invalid_content_fails_before_touching_database(self) -> None:
        sync_courses(self.db, self.root, self.specs, self.practice_root)
        before = list(self.db.scalars(select(Course.slug).order_by(Course.slug)))
        shutil.rmtree(self.root / "fixture-two" / "res")
        with self.assertRaisesRegex(ContentSyncError, "fixture-two"):
            sync_courses(self.db, self.root, self.specs, self.practice_root)
        self.assertEqual(
            list(self.db.scalars(select(Course.slug).order_by(Course.slug))), before
        )

    def test_database_failure_rolls_back_previous_catalog(self) -> None:
        sync_courses(self.db, self.root, self.specs, self.practice_root)
        path = self.root / "fixture-one" / "01.第一课.md"
        path.write_text("# 事务失败后的新内容\n", encoding="utf-8")

        def fail_flush(_session: Session, _context, _instances) -> None:
            raise RuntimeError("forced flush failure")

        event.listen(self.db, "before_flush", fail_flush, once=True)
        with self.assertRaisesRegex(RuntimeError, "forced flush failure"):
            sync_courses(self.db, self.root, self.specs, self.practice_root)
        self.db.expire_all()
        self.assertEqual(self.db.scalar(select(func.count(Course.id))), 2)
        self.assertNotIn(
            "事务失败",
            self.db.scalar(select(Lesson.markdown).where(Lesson.title == "第一课")),
        )


if __name__ == "__main__":
    unittest.main()
