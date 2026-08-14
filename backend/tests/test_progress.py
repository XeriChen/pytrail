"""Atomic lesson progress upserts: dialects, concurrency, and foreign keys."""

from __future__ import annotations

import tempfile
import threading
import unittest
from pathlib import Path

from sqlalchemy import create_engine, event, func, select
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import Base
from app.models import Course, Lesson, Progress, User
from app.progress_service import build_progress_upsert, upsert_lesson_progress


class ProgressUpsertTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.engine = create_engine(f"sqlite:///{(Path(self.temp_dir.name) / 'progress.db').as_posix()}")

        @event.listens_for(self.engine, "connect")
        def _fk(dbapi_connection, _record) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine, autoflush=False)
        self.user = User(name="Ada", email="ada@example.com", password_hash="hash")
        self.db.add(self.user)
        self.db.commit()
        course = Course(title="Fixture", slug="fixture", description="Fixture course", level="beginner", accent="jade")
        self.db.add(course)
        self.db.commit()
        self.lesson = Lesson(course_id=course.id, source_path="Day01-20/01.第一课.md", title="第一课", order=1, duration=8, markdown="# 第一课")
        self.db.add(self.lesson)
        self.db.commit()
        self.user_id = self.user.id
        self.lesson_id = self.lesson.id

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()
        self.temp_dir.cleanup()

    def _session(self) -> Session:
        return Session(self.engine, autoflush=False)

    def test_first_write_creates_row_and_second_write_updates_in_place(self) -> None:
        first = upsert_lesson_progress(self.db, user_id=self.user_id, lesson_id=self.lesson_id, completed=True, score=100)
        self.assertEqual(first.completed, True)
        self.assertEqual(first.score, 100)
        second = upsert_lesson_progress(self.db, user_id=self.user_id, lesson_id=self.lesson_id, completed=False, score=40)
        self.assertEqual(second.completed, False)
        self.assertEqual(second.score, 40)
        self.assertEqual(self.db.scalar(select(func.count(Progress.id))), 1)

    def test_concurrent_first_writes_produce_one_row_without_errors(self) -> None:
        threads = 6
        barrier = threading.Barrier(threads)
        errors: list[BaseException] = []

        def worker() -> None:
            session = self._session()
            try:
                barrier.wait()
                upsert_lesson_progress(session, user_id=self.user_id, lesson_id=self.lesson_id, completed=True, score=90)
            except BaseException as exc:  # pragma: no cover - collected for assertion
                errors.append(exc)
            finally:
                session.close()

        workers = [threading.Thread(target=worker) for _ in range(threads)]
        for item in workers:
            item.start()
        for item in workers:
            item.join()
        self.assertEqual(errors, [])
        self.assertEqual(self.db.scalar(select(func.count(Progress.id))), 1)

    def test_sqlite_and_postgresql_dialects_compile_conflict_clause(self) -> None:
        sqlite_sql = str(build_progress_upsert("sqlite", user_id=1, lesson_id=1, completed=True, score=90).compile(dialect=sqlite.dialect()))
        postgres_sql = str(build_progress_upsert("postgresql", user_id=1, lesson_id=1, completed=True, score=90).compile(dialect=postgresql.dialect()))
        self.assertIn("ON CONFLICT", sqlite_sql.upper())
        self.assertIn("ON CONFLICT", postgres_sql.upper())

    def test_unknown_dialect_is_rejected(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "Unsupported database dialect"):
            build_progress_upsert("mysql", user_id=1, lesson_id=1, completed=True, score=90)

    def test_foreign_keys_reject_orphan_progress(self) -> None:
        with self._session() as session:
            with self.assertRaises(IntegrityError):
                session.add(Progress(user_id=self.user_id, lesson_id=999_999, completed=True, score=100))
                session.commit()
            session.rollback()
        self.assertEqual(self.db.scalar(select(func.count(Progress.id))), 0)


if __name__ == "__main__":
    unittest.main()
