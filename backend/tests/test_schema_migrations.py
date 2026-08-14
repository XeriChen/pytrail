from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from sqlalchemy import create_engine, inspect, text

from app.schema_migrations import PRACTICE_SCHEMA_VERSION, upgrade_schema


LEGACY_SCHEMA = (
    "CREATE TABLE users (id INTEGER PRIMARY KEY, name VARCHAR(80) NOT NULL, "
    "email VARCHAR(160) NOT NULL UNIQUE, password_hash VARCHAR(256) NOT NULL, created_at DATETIME NOT NULL)",
    "CREATE TABLE courses (id INTEGER PRIMARY KEY, title VARCHAR(160) NOT NULL, "
    "slug VARCHAR(160) NOT NULL UNIQUE, description TEXT NOT NULL, level VARCHAR(30) NOT NULL, accent VARCHAR(20) NOT NULL)",
    "CREATE TABLE lessons (id INTEGER PRIMARY KEY, course_id INTEGER NOT NULL REFERENCES courses(id), "
    "title VARCHAR(160) NOT NULL, \"order\" INTEGER NOT NULL, duration INTEGER NOT NULL, markdown TEXT NOT NULL)",
    "CREATE TABLE exercises (id INTEGER PRIMARY KEY, lesson_id INTEGER NOT NULL REFERENCES lessons(id), "
    "prompt TEXT NOT NULL, starter_code TEXT NOT NULL, expected_answer VARCHAR(160) NOT NULL)",
    "CREATE TABLE progress (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), "
    "lesson_id INTEGER NOT NULL REFERENCES lessons(id), completed BOOLEAN NOT NULL, score INTEGER NOT NULL, "
    "updated_at DATETIME NOT NULL, CONSTRAINT uq_progress_user_lesson UNIQUE (user_id, lesson_id))",
)


class SchemaMigrationTests(unittest.TestCase):
    def setUp(self) -> None:
        handle = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        handle.close()
        self.path = Path(handle.name)
        self.engine = create_engine(f"sqlite:///{self.path.as_posix()}")
        with self.engine.begin() as connection:
            for statement in LEGACY_SCHEMA:
                connection.execute(text(statement))
            connection.execute(text(
                "INSERT INTO users VALUES (7, 'Ada', 'ada@example.com', 'hash', '2026-08-14 00:00:00')"
            ))
            connection.execute(text(
                "INSERT INTO courses VALUES (11, 'Python 基础', 'python-foundations', 'desc', 'beginner', 'jade')"
            ))
            connection.execute(text(
                "INSERT INTO lessons VALUES (13, 11, '第一课', 1, 8, '# 第一课')"
            ))
            connection.execute(text(
                "INSERT INTO exercises VALUES (17, 13, 'Which function prints?', 'print(1)', 'print')"
            ))
            connection.execute(text(
                "INSERT INTO progress VALUES (19, 7, 13, 1, 100, '2026-08-14 00:00:00')"
            ))

    def tearDown(self) -> None:
        self.engine.dispose()
        self.path.unlink(missing_ok=True)

    def test_upgrade_adds_practice_schema_without_losing_legacy_rows(self) -> None:
        upgrade_schema(self.engine)

        inspector = inspect(self.engine)
        exercise_columns = {item["name"] for item in inspector.get_columns("exercises")}
        lesson_columns = {item["name"] for item in inspector.get_columns("lessons")}
        self.assertIn("source_path", lesson_columns)
        self.assertTrue(
            {"slug", "kind", "title", "difficulty", "function_name", "signature_json", "order"}
            <= exercise_columns
        )
        self.assertTrue(
            {"exercise_cases", "tags", "exercise_tags", "exercise_progress", "schema_migrations"}
            <= set(inspector.get_table_names())
        )
        with self.engine.connect() as connection:
            self.assertEqual(connection.scalar(text("SELECT COUNT(*) FROM users")), 1)
            self.assertEqual(connection.scalar(text("SELECT COUNT(*) FROM progress")), 1)
            legacy = connection.execute(text(
                "SELECT id, kind, prompt, expected_answer FROM exercises WHERE id = 17"
            )).one()
        self.assertEqual(tuple(legacy), (17, "quick_check", "Which function prints?", "print"))

    def test_upgrade_is_idempotent(self) -> None:
        upgrade_schema(self.engine)
        upgrade_schema(self.engine)

        with self.engine.connect() as connection:
            versions = connection.execute(text("SELECT version FROM schema_migrations")).scalars().all()
        self.assertEqual(versions, [PRACTICE_SCHEMA_VERSION])


if __name__ == "__main__":
    unittest.main()
