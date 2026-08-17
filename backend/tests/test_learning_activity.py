"""Effective-learning activity persistence and dialect behavior."""

from __future__ import annotations

import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path

from sqlalchemy import create_engine, func, select
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.orm import Session

from app.activity_service import (
    LESSON_COMPLETED,
    activity_dates,
    build_activity_insert,
    record_activity,
)
from app.database import Base
from app.models import LearningActivity, User


class LearningActivityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.engine = create_engine(
            f"sqlite:///{(Path(self.temp_dir.name) / 'activity.db').as_posix()}"
        )
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine, autoflush=False)
        user = User(name="Ada", email="ada@example.com", password_hash="hash")
        self.db.add(user)
        self.db.commit()
        self.user_id = user.id

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()
        self.temp_dir.cleanup()

    def test_same_source_is_deduplicated_per_utc_day_but_preserves_history(
        self,
    ) -> None:
        today = date(2026, 8, 17)
        for _ in range(2):
            record_activity(
                self.db,
                user_id=self.user_id,
                kind=LESSON_COMPLETED,
                source_key="Day01-20/01.初识Python.md",
                activity_date=today,
            )
        record_activity(
            self.db,
            user_id=self.user_id,
            kind=LESSON_COMPLETED,
            source_key="Day01-20/01.初识Python.md",
            activity_date=today - timedelta(days=1),
        )
        self.db.commit()

        self.assertEqual(self.db.scalar(select(func.count(LearningActivity.id))), 2)
        self.assertEqual(
            activity_dates(self.db, self.user_id),
            {today - timedelta(days=1), today},
        )

    def test_sqlite_and_postgresql_inserts_compile_conflict_clause(self) -> None:
        values = {
            "user_id": 1,
            "kind": LESSON_COMPLETED,
            "source_key": "lesson",
            "activity_date": date(2026, 8, 17),
        }
        sqlite_sql = str(
            build_activity_insert("sqlite", **values).compile(dialect=sqlite.dialect())
        )
        postgres_sql = str(
            build_activity_insert("postgresql", **values).compile(
                dialect=postgresql.dialect()
            )
        )
        self.assertIn("ON CONFLICT", sqlite_sql.upper())
        self.assertIn("ON CONFLICT", postgres_sql.upper())

    def test_invalid_kind_dialect_and_source_are_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "Unknown learning activity kind"):
            build_activity_insert(
                "sqlite",
                user_id=self.user_id,
                kind="failed",
                source_key="lesson",
                activity_date=date.today(),
            )
        with self.assertRaisesRegex(RuntimeError, "Unsupported database dialect"):
            build_activity_insert(
                "mysql",
                user_id=self.user_id,
                kind=LESSON_COMPLETED,
                source_key="lesson",
                activity_date=date.today(),
            )
        with self.assertRaisesRegex(ValueError, "source_key"):
            record_activity(
                self.db,
                user_id=self.user_id,
                kind=LESSON_COMPLETED,
                source_key="  ",
            )


if __name__ == "__main__":
    unittest.main()
