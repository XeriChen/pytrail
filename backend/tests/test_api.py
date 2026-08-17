"""Drive the shipped FastAPI app. Isolate onto a temp SQLite before import."""

from __future__ import annotations

import os
import sys
import tempfile
import unittest
import warnings
from datetime import UTC, date, datetime, timedelta
from itertools import count
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as temp_database:
    _DB_PATH = Path(temp_database.name)
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_PATH.as_posix()}"
os.environ["SECRET_KEY"] = f"unit-test-secret-{os.urandom(8).hex()}"
os.environ["PYTRAIL_ENV"] = "development"

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app.auth import (  # noqa: E402
    KNOWN_INSECURE_SECRETS,
    USERLESS_MODE_ENV,
    enforce_secret_key_policy,
    is_insecure_secret,
    is_production_environment,
    is_userless_mode,
)
from app.database import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.metrics import compute_streak  # noqa: E402
from app.models import Exercise, ExerciseProgress, Progress, User  # noqa: E402
from app.ratelimit import auth_limiter, practice_limiter  # noqa: E402

_EMAILS = count(1)


def unique_email() -> str:
    return f"learner{next(_EMAILS)}@example.com"


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client_cm = TestClient(app)
        cls.client = cls.client_cm.__enter__()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.client_cm.__exit__(None, None, None)
        engine.dispose()
        _DB_PATH.unlink(missing_ok=True)

    def setUp(self) -> None:
        auth_limiter.reset()
        practice_limiter.reset()

    def register(
        self, email: str | None = None, password: str = "password123", name: str = "Ada"
    ) -> dict:
        payload = {"name": name, "email": email or unique_email(), "password": password}
        response = self.client.post("/api/auth/register", json=payload)
        self.assertEqual(response.status_code, 201, response.text)
        body = response.json()
        return {
            "headers": {"Authorization": f"Bearer {body['access_token']}"},
            "email": payload["email"],
            "user": body["user"],
        }

    def test_health_ok(self) -> None:
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")

    def test_userless_mode_is_opt_in(self) -> None:
        self.assertFalse(is_userless_mode())
        self.assertEqual(
            self.client.get("/api/config").json(), {"userless_mode": False}
        )
        with patch.dict(os.environ, {USERLESS_MODE_ENV: "1"}):
            self.assertTrue(is_userless_mode())
            self.assertEqual(
                self.client.get("/api/config").json(), {"userless_mode": True}
            )

    def test_userless_mode_runs_without_auth_and_does_not_persist_progress(
        self,
    ) -> None:
        code = "def filter_and_square(numbers, minimum):\n    return [number * number for number in numbers if number >= minimum]\n"
        with SessionLocal() as db:
            exercise_progress_before = len(db.scalars(select(ExerciseProgress)).all())
            lesson_progress_before = len(db.scalars(select(Progress)).all())
            users_before = len(db.scalars(select(User)).all())
        with patch.dict(os.environ, {USERLESS_MODE_ENV: "1"}):
            self.assertEqual(
                self.client.post(
                    "/api/auth/register",
                    json={
                        "name": "Ada",
                        "email": unique_email(),
                        "password": "password123",
                    },
                ).status_code,
                404,
            )
            run = self.client.post(
                "/api/practice/exercises/filter-and-square/run", json={"code": code}
            )
            self.assertEqual(run.status_code, 200, run.text)
            self.assertTrue(run.json()["passed"])
            self.assertIsNone(run.json()["progress"])

            lesson = self.client.get("/api/lessons/1").json()
            exercise_id = lesson["exercises"][0]["id"]
            quick_check = self.client.post(
                f"/api/exercises/{exercise_id}/submit", json={"answer": "wrong"}
            )
            self.assertEqual(quick_check.status_code, 200, quick_check.text)
            self.assertFalse(quick_check.json()["correct"])
            self.assertFalse(quick_check.json()["persisted"])

            progress = self.client.post(
                "/api/progress",
                json={"lesson_id": lesson["id"], "completed": True, "score": 100},
            )
            self.assertEqual(progress.status_code, 200, progress.text)
            self.assertFalse(progress.json()["persisted"])
            self.assertEqual(self.client.get("/api/auth/me").status_code, 404)
            self.assertEqual(self.client.get("/api/dashboard").status_code, 404)

        with SessionLocal() as db:
            self.assertEqual(
                len(db.scalars(select(ExerciseProgress)).all()),
                exercise_progress_before,
            )
            self.assertEqual(
                len(db.scalars(select(Progress)).all()), lesson_progress_before
            )
            self.assertEqual(len(db.scalars(select(User)).all()), users_before)

    def test_lifespan_releases_startup_session_before_serving(self) -> None:
        with TestClient(app) as client:
            self.assertEqual(client.get("/api/health").status_code, 200)
            self.assertEqual(engine.pool.checkedout(), 0)

    def test_courses_nonempty(self) -> None:
        response = self.client.get("/api/courses")
        self.assertEqual(response.status_code, 200)
        courses = response.json()
        self.assertEqual(len(courses), 9)
        self.assertEqual(sum(course["lesson_count"] for course in courses), 102)
        self.assertNotIn("lessons", courses[0])
        self.assertNotIn("markdown", courses[0])

        detail = self.client.get(f"/api/courses/{courses[0]['id']}")
        self.assertEqual(detail.status_code, 200)
        lessons = detail.json()["lessons"]
        self.assertEqual(len(lessons), 20)
        self.assertNotIn("markdown", lessons[0])
        self.assertTrue(lessons[0]["has_exercises"])

        lesson = self.client.get(f"/api/lessons/{lessons[0]['id']}")
        self.assertEqual(lesson.status_code, 200)
        payload = lesson.json()
        self.assertIn("初识Python", payload["markdown"])
        self.assertEqual(payload["course_slug"], "python-foundations")
        self.assertTrue(payload["asset_base_url"].endswith("/python-foundations/"))
        self.assertTrue(payload["exercises"])

    def test_public_practice_catalog_detail_and_filters(self) -> None:
        response = self.client.get("/api/practice/exercises")
        self.assertEqual(response.status_code, 200, response.text)
        catalog = response.json()
        self.assertEqual(catalog["total"], 36)
        self.assertEqual(len(catalog["items"]), 12)
        self.assertEqual(catalog["items"][0]["slug"], "prime-range-summary")
        self.assertIsNone(catalog["items"][0]["progress"])
        self.assertEqual(len(catalog["facets"]["courses"]), 9)

        filtered = self.client.get(
            "/api/practice/exercises",
            params={
                "course": "python-foundations",
                "difficulty": "easy",
                "tag": "loops",
                "page_size": 48,
            },
        )
        self.assertEqual(filtered.status_code, 200, filtered.text)
        self.assertGreater(filtered.json()["total"], 0)
        self.assertTrue(
            all(
                item["course"]["slug"] == "python-foundations"
                for item in filtered.json()["items"]
            )
        )

        detail = self.client.get("/api/practice/exercises/prime-range-summary")
        self.assertEqual(detail.status_code, 200, detail.text)
        payload = detail.json()
        self.assertEqual(payload["function_name"], "prime_summary")
        self.assertEqual(len(payload["cases"]), 4)
        self.assertIn("expected", payload["cases"][0])
        self.assertNotIn("expected_answer", payload)
        self.assertEqual(
            self.client.get("/api/practice/exercises/not-found").status_code, 404
        )
        self.assertEqual(
            self.client.get(
                "/api/practice/exercises", params={"difficulty": "expert"}
            ).status_code,
            422,
        )
        self.assertEqual(
            self.client.get(
                "/api/practice/exercises", params={"status": "passed"}
            ).status_code,
            401,
        )

    def test_practice_run_requires_auth_and_persists_monotonic_progress(self) -> None:
        slug = "filter-and-square"
        self.assertEqual(
            self.client.post(
                f"/api/practice/exercises/{slug}/run", json={"code": "def x(): pass"}
            ).status_code,
            401,
        )
        auth = self.register()
        starter_code = self.client.get(f"/api/practice/exercises/{slug}").json()[
            "starter_code"
        ]
        failed_code = "def filter_and_square(numbers, minimum):\n    return []\n"
        failed = self.client.post(
            f"/api/practice/exercises/{slug}/run",
            headers=auth["headers"],
            json={"code": failed_code},
        )
        self.assertEqual(failed.status_code, 200, failed.text)
        self.assertFalse(failed.json()["passed"])
        self.assertEqual(failed.json()["progress"]["status"], "in_progress")
        self.assertEqual(failed.json()["progress"]["attempts"], 1)

        passed_code = "def filter_and_square(numbers, minimum):\n    return [value * value for value in numbers if value >= minimum]\n"
        passed = self.client.post(
            f"/api/practice/exercises/{slug}/run",
            headers=auth["headers"],
            json={"code": passed_code},
        )
        self.assertEqual(passed.status_code, 200, passed.text)
        self.assertTrue(passed.json()["passed"], passed.text)
        self.assertEqual(passed.json()["progress"]["status"], "passed")

        again = self.client.post(
            f"/api/practice/exercises/{slug}/run",
            headers=auth["headers"],
            json={"code": failed_code},
        )
        self.assertEqual(again.json()["progress"]["status"], "passed")
        self.assertEqual(again.json()["progress"]["attempts"], 3)
        resumed = self.client.get(
            f"/api/practice/exercises/{slug}", headers=auth["headers"]
        ).json()
        self.assertEqual(resumed["starter_code"], starter_code)
        self.assertEqual(resumed["progress"]["last_code"], failed_code)

        status = self.client.get(
            "/api/practice/exercises",
            headers=auth["headers"],
            params={"status": "passed", "page_size": 48},
        )
        self.assertEqual(status.status_code, 200, status.text)
        self.assertIn(slug, [item["slug"] for item in status.json()["items"]])

    def test_legacy_submit_rejects_function_exercises(self) -> None:
        auth = self.register()
        with SessionLocal() as db:
            exercise = db.scalar(select(Exercise).where(Exercise.kind == "function"))
            exercise_id = exercise.id
        response = self.client.post(
            f"/api/exercises/{exercise_id}/submit",
            headers=auth["headers"],
            json={"answer": "x"},
        )
        self.assertEqual(response.status_code, 404)

    def test_practice_validation_limits_and_runner_failure_are_bounded(self) -> None:
        auth = self.register()
        slug = "filter-and-square"
        oversized = self.client.post(
            f"/api/practice/exercises/{slug}/run",
            headers=auth["headers"],
            json={"code": "x" * 12_001},
        )
        self.assertEqual(oversized.status_code, 413)

        invalid = self.client.post(
            f"/api/practice/exercises/{slug}/run",
            headers=auth["headers"],
            json={
                "code": "import os\ndef filter_and_square(numbers, minimum): return []"
            },
        )
        self.assertEqual(invalid.status_code, 200, invalid.text)
        self.assertFalse(invalid.json()["ok"])
        self.assertIn("Import", invalid.json()["error"])

        with patch("app.main.run_practice", side_effect=OSError("worker unavailable")):
            unavailable = self.client.post(
                f"/api/practice/exercises/{slug}/run",
                headers=auth["headers"],
                json={"code": "def filter_and_square(numbers, minimum): return []"},
            )
        self.assertEqual(unavailable.status_code, 503)
        with SessionLocal() as db:
            exercise = db.scalar(select(Exercise).where(Exercise.slug == slug))
            progress = db.scalar(
                select(ExerciseProgress).where(
                    ExerciseProgress.user_id == auth["user"]["id"],
                    ExerciseProgress.exercise_id == exercise.id,
                )
            )
            self.assertEqual(progress.attempts, 1)

    def test_catalog_errors_and_assets_are_safe(self) -> None:
        self.assertEqual(self.client.get("/api/courses/999999").status_code, 404)
        self.assertEqual(self.client.get("/api/lessons/999999").status_code, 404)
        courses = self.client.get("/api/courses").json()
        second = self.client.get(f"/api/courses/{courses[1]['id']}").json()
        lesson = self.client.get(f"/api/lessons/{second['lessons'][0]['id']}").json()
        self.assertEqual(lesson["exercises"], [])

        asset = self.client.get(
            "/api/course-assets/python-foundations/res/day01/tiobe_index.png"
        )
        self.assertEqual(asset.status_code, 200)
        self.assertEqual(asset.headers["content-type"], "image/png")
        self.assertEqual(
            self.client.get("/api/course-assets/not-a-course/res/a.png").status_code,
            404,
        )
        self.assertEqual(
            self.client.get(
                "/api/course-assets/python-foundations/%2E%2E/01.%E5%88%9D%E8%AF%86Python.md"
            ).status_code,
            404,
        )

    def test_execute_disabled_by_default(self) -> None:
        response = self.client.post("/api/execute", json={"code": "print(1)"})
        self.assertEqual(response.status_code, 404)
        auth = self.register()
        response = self.client.post(
            "/api/execute", json={"code": "print(1)"}, headers=auth["headers"]
        )
        self.assertEqual(response.status_code, 404)

    def test_execute_requires_auth_when_enabled(self) -> None:
        with patch.dict(os.environ, {"PYTRAIL_ENABLE_LEGACY_EXECUTE": "1"}):
            response = self.client.post("/api/execute", json={"code": "print(1)"})
        self.assertNotEqual(response.status_code, 200)
        self.assertEqual(response.status_code, 401)

    def test_execute_prints_stdout_when_enabled(self) -> None:
        auth = self.register()
        marker = "pytrail-hello-stdout"
        with patch.dict(os.environ, {"PYTRAIL_ENABLE_LEGACY_EXECUTE": "1"}):
            response = self.client.post(
                "/api/execute",
                json={"code": f"print({marker!r})"},
                headers=auth["headers"],
            )
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertTrue(body["ok"])
        self.assertIn(marker, body["stdout"])

    def test_execute_rejects_oversize_code_when_enabled(self) -> None:
        auth = self.register()
        with patch.dict(os.environ, {"PYTRAIL_ENABLE_LEGACY_EXECUTE": "1"}):
            response = self.client.post(
                "/api/execute", json={"code": "x" * 4001}, headers=auth["headers"]
            )
        self.assertEqual(response.status_code, 413)

    def test_execute_unavailable_in_production_even_when_enabled(self) -> None:
        auth = self.register()
        with patch.dict(
            os.environ,
            {"PYTRAIL_ENABLE_LEGACY_EXECUTE": "1", "PYTRAIL_ENV": "production"},
        ):
            response = self.client.post(
                "/api/execute", json={"code": "print(1)"}, headers=auth["headers"]
            )
        self.assertEqual(response.status_code, 404)

    def test_execute_timeout_fails_closed_when_enabled(self) -> None:
        auth = self.register()
        with patch.dict(os.environ, {"PYTRAIL_ENABLE_LEGACY_EXECUTE": "1"}):
            response = self.client.post(
                "/api/execute",
                json={"code": "import time\ntime.sleep(5)"},
                headers=auth["headers"],
            )
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertFalse(body["ok"])
        self.assertIn("timed out", body["stderr"].lower())

    def test_progress_rejects_unknown_lesson(self) -> None:
        auth = self.register()
        response = self.client.post(
            "/api/progress",
            json={"lesson_id": 999_999, "completed": True, "score": 100},
            headers=auth["headers"],
        )
        self.assertEqual(response.status_code, 404)

    def test_progress_upsert_updates_a_single_row(self) -> None:
        auth = self.register()
        courses = self.client.get("/api/courses").json()
        lesson_id = self.client.get(f"/api/courses/{courses[0]['id']}").json()[
            "lessons"
        ][0]["id"]
        first = self.client.post(
            "/api/progress",
            json={"lesson_id": lesson_id, "completed": True, "score": 100},
            headers=auth["headers"],
        )
        self.assertEqual(first.status_code, 200, first.text)
        second = self.client.post(
            "/api/progress",
            json={"lesson_id": lesson_id, "completed": False, "score": 37},
            headers=auth["headers"],
        )
        self.assertEqual(second.status_code, 200, second.text)
        self.assertFalse(second.json()["completed"])
        with SessionLocal() as db:
            rows = db.scalars(
                select(Progress).where(Progress.user_id == auth["user"]["id"])
            ).all()
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0].score, 37)

    def test_quick_check_submit_persists_recent_lesson_result(self) -> None:
        auth = self.register()
        lesson = self.client.get("/api/lessons/1").json()
        self.assertTrue(lesson["exercises"])
        exercise = lesson["exercises"][0]
        wrong = self.client.post(
            f"/api/exercises/{exercise['id']}/submit",
            json={"answer": "definitely-not-the-answer"},
            headers=auth["headers"],
        )
        self.assertEqual(wrong.status_code, 200, wrong.text)
        self.assertFalse(wrong.json()["correct"])
        self.assertEqual(wrong.json()["score"], 40)
        with SessionLocal() as db:
            rows = db.scalars(
                select(Progress).where(Progress.user_id == auth["user"]["id"])
            ).all()
            self.assertEqual(len(rows), 1)
            self.assertFalse(rows[0].completed)

    def test_concurrent_first_progress_writes_via_api(self) -> None:
        import threading

        auth = self.register()
        courses = self.client.get("/api/courses").json()
        lesson_id = self.client.get(f"/api/courses/{courses[0]['id']}").json()[
            "lessons"
        ][1]["id"]
        barrier = threading.Barrier(6)
        statuses: list[int] = []

        def worker() -> None:
            barrier.wait()
            response = self.client.post(
                "/api/progress",
                json={"lesson_id": lesson_id, "completed": True, "score": 80},
                headers=auth["headers"],
            )
            statuses.append(response.status_code)

        threads = [threading.Thread(target=worker) for _ in range(6)]
        for item in threads:
            item.start()
        for item in threads:
            item.join()
        self.assertEqual(statuses, [200] * 6)
        with SessionLocal() as db:
            rows = db.scalars(
                select(Progress).where(Progress.user_id == auth["user"]["id"])
            ).all()
            self.assertEqual(len(rows), 1)

    def test_sqlite_foreign_keys_are_enforced(self) -> None:
        from sqlalchemy.exc import IntegrityError

        with engine.connect() as connection:
            self.assertEqual(
                connection.exec_driver_sql("PRAGMA foreign_keys").scalar(), 1
            )
        auth = self.register()
        with SessionLocal() as db:
            with self.assertRaises(IntegrityError):
                db.add(
                    Progress(
                        user_id=auth["user"]["id"],
                        lesson_id=999_999,
                        completed=True,
                        score=100,
                    )
                )
                db.commit()
            db.rollback()

    def test_register_normalizes_email_and_rejects_blank_name(self) -> None:
        response = self.client.post(
            "/api/auth/register",
            json={
                "name": "  Ada  ",
                "email": "  ADA@Example.COM  ",
                "password": "password123",
            },
        )
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(response.json()["user"]["email"], "ada@example.com")
        self.assertEqual(response.json()["user"]["name"], "Ada")
        login = self.client.post(
            "/api/auth/login",
            json={"email": "ADA@example.com", "password": "password123"},
        )
        self.assertEqual(login.status_code, 200, login.text)
        blank = self.client.post(
            "/api/auth/register",
            json={"name": "   ", "email": unique_email(), "password": "password123"},
        )
        self.assertEqual(blank.status_code, 422)
        short_password = self.client.post(
            "/api/auth/register",
            json={"name": "Ada", "email": unique_email(), "password": "short"},
        )
        self.assertEqual(short_password.status_code, 422)

    def test_register_rejects_oversized_fields(self) -> None:
        response = self.client.post(
            "/api/auth/register",
            json={"name": "x" * 81, "email": unique_email(), "password": "password123"},
        )
        self.assertEqual(response.status_code, 422)
        response = self.client.post(
            "/api/auth/register",
            json={
                "name": "Ada",
                "email": f"{'a' * 160}@example.com",
                "password": "password123",
            },
        )
        self.assertEqual(response.status_code, 422)
        response = self.client.post(
            "/api/auth/register",
            json={"name": "Ada", "email": unique_email(), "password": "p" * 129},
        )
        self.assertEqual(response.status_code, 422)

    def test_register_password_is_not_trimmed(self) -> None:
        padded = "  password123  "
        response = self.client.post(
            "/api/auth/register",
            json={"name": "Ada", "email": unique_email(), "password": padded},
        )
        self.assertEqual(response.status_code, 201, response.text)
        trimmed_login = self.client.post(
            "/api/auth/login",
            json={"email": response.json()["user"]["email"], "password": "password123"},
        )
        self.assertEqual(trimmed_login.status_code, 401)
        exact_login = self.client.post(
            "/api/auth/login",
            json={"email": response.json()["user"]["email"], "password": padded},
        )
        self.assertEqual(exact_login.status_code, 200, exact_login.text)

    def test_concurrent_duplicate_registration_returns_conflict_not_500(self) -> None:
        import threading

        email = unique_email()
        barrier = threading.Barrier(4)
        statuses: list[int] = []

        def worker() -> None:
            barrier.wait()
            response = self.client.post(
                "/api/auth/register",
                json={"name": "Ada", "email": email, "password": "password123"},
            )
            statuses.append(response.status_code)

        threads = [threading.Thread(target=worker) for _ in range(4)]
        for item in threads:
            item.start()
        for item in threads:
            item.join()
        self.assertEqual(statuses.count(201), 1)
        self.assertEqual(statuses.count(409), 3)

    def test_secret_key_policy_refuses_short_keys_in_production(self) -> None:
        with self.assertRaises(RuntimeError):
            enforce_secret_key_policy(secret="short-key", environment="production")
        with self.assertRaises(RuntimeError):
            enforce_secret_key_policy(secret="x" * 15, environment="production")
        acceptable = "x" * 16
        self.assertFalse(is_insecure_secret(acceptable))
        self.assertEqual(
            enforce_secret_key_policy(secret=acceptable, environment="production"),
            acceptable,
        )

    def test_login_burst_is_rate_limited(self) -> None:
        email = unique_email()
        self.register(email=email)
        statuses = [
            self.client.post(
                "/api/auth/login", json={"email": email, "password": "wrong-password"}
            ).status_code
            for _ in range(8)
        ]
        self.assertIn(429, statuses)
        self.assertTrue(any(code == 401 for code in statuses))

    def test_register_burst_is_rate_limited(self) -> None:
        statuses = [
            self.client.post(
                "/api/auth/register",
                json={
                    "name": "Burst",
                    "email": unique_email(),
                    "password": "password123",
                },
            ).status_code
            for _ in range(8)
        ]
        self.assertIn(429, statuses)
        self.assertTrue(any(code == 201 for code in statuses))

    def test_dashboard_streak_is_not_hardcoded(self) -> None:
        auth = self.register()
        headers = auth["headers"]
        empty = self.client.get("/api/dashboard", headers=headers)
        self.assertEqual(empty.status_code, 200)
        empty_body = empty.json()
        self.assertEqual(empty_body["streak"], 0)
        self.assertEqual(empty_body["lessons_completed"], 0)
        self.assertEqual(empty_body["completion"], 0)

        courses = self.client.get("/api/courses").json()
        lessons = self.client.get(f"/api/courses/{courses[0]['id']}").json()["lessons"]
        self.assertGreaterEqual(len(lessons), 2)
        first_id = lessons[0]["id"]
        second_id = lessons[1]["id"]

        today_progress = self.client.post(
            "/api/progress",
            json={"lesson_id": first_id, "completed": True, "score": 100},
            headers=headers,
        )
        self.assertEqual(today_progress.status_code, 200)
        after_one = self.client.get("/api/dashboard", headers=headers).json()
        self.assertEqual(after_one["lessons_completed"], 1)
        self.assertGreater(after_one["completion"], 0)
        self.assertEqual(after_one["streak"], 1)
        self.assertNotEqual(after_one["streak"], 4)

        yesterday_progress = self.client.post(
            "/api/progress",
            json={"lesson_id": second_id, "completed": True, "score": 90},
            headers=headers,
        )
        self.assertEqual(yesterday_progress.status_code, 200)
        db = SessionLocal()
        try:
            rows = db.scalars(
                select(Progress).where(Progress.user_id == auth["user"]["id"])
            ).all()
            self.assertEqual(len(rows), 2)
            older = next(item for item in rows if item.lesson_id == second_id)
            older.updated_at = datetime.now(UTC) - timedelta(days=1)
            db.commit()
        finally:
            db.close()

        after_two = self.client.get("/api/dashboard", headers=headers).json()
        self.assertEqual(after_two["lessons_completed"], 2)
        self.assertEqual(after_two["streak"], 2)
        self.assertGreater(after_two["completion"], after_one["completion"])

    def test_compute_streak_from_history(self) -> None:
        today = date(2026, 8, 13)
        self.assertEqual(compute_streak([], today=today), 0)
        self.assertEqual(compute_streak([today], today=today), 1)
        self.assertEqual(
            compute_streak([today, today - timedelta(days=1)], today=today), 2
        )
        self.assertEqual(compute_streak([today - timedelta(days=3)], today=today), 0)
        self.assertNotEqual(compute_streak([today], today=today), 4)

    def test_secret_key_policy_refuses_defaults_in_production(self) -> None:
        insecure = next(iter(KNOWN_INSECURE_SECRETS))
        self.assertTrue(is_insecure_secret(insecure))
        self.assertTrue(is_production_environment("production"))
        with self.assertRaises(RuntimeError):
            enforce_secret_key_policy(secret=insecure, environment="production")
        unique = f"rotated-secret-{os.urandom(8).hex()}"
        self.assertFalse(is_insecure_secret(unique))
        self.assertEqual(
            enforce_secret_key_policy(secret=unique, environment="production"), unique
        )
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            returned = enforce_secret_key_policy(
                secret=insecure, environment="development"
            )
        self.assertEqual(returned, insecure)
        self.assertTrue(any(issubclass(item.category, UserWarning) for item in caught))


if __name__ == "__main__":
    unittest.main()
