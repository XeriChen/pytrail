"""Drive the shipped FastAPI app. Isolate onto a temp SQLite before import."""

from __future__ import annotations

import os
import sys
import tempfile
import unittest
import warnings
from datetime import date, datetime, timedelta, timezone
from itertools import count
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

_DB = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_DB.close()
os.environ["DATABASE_URL"] = f"sqlite:///{Path(_DB.name).as_posix()}"
os.environ["SECRET_KEY"] = f"unit-test-secret-{os.urandom(8).hex()}"
os.environ["PYTRAIL_ENV"] = "development"

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app.auth import (  # noqa: E402
    KNOWN_INSECURE_SECRETS,
    enforce_secret_key_policy,
    is_insecure_secret,
    is_production_environment,
)
from app.database import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.metrics import compute_streak  # noqa: E402
from app.models import Exercise, Progress  # noqa: E402
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
        Path(_DB.name).unlink(missing_ok=True)

    def setUp(self) -> None:
        auth_limiter.reset()
        practice_limiter.reset()

    def register(self, email: str | None = None, password: str = "password123", name: str = "Ada") -> dict:
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

        filtered = self.client.get("/api/practice/exercises", params={"course": "python-foundations", "difficulty": "easy", "tag": "loops", "page_size": 48})
        self.assertEqual(filtered.status_code, 200, filtered.text)
        self.assertGreater(filtered.json()["total"], 0)
        self.assertTrue(all(item["course"]["slug"] == "python-foundations" for item in filtered.json()["items"]))

        detail = self.client.get("/api/practice/exercises/prime-range-summary")
        self.assertEqual(detail.status_code, 200, detail.text)
        payload = detail.json()
        self.assertEqual(payload["function_name"], "prime_summary")
        self.assertEqual(len(payload["cases"]), 4)
        self.assertIn("expected", payload["cases"][0])
        self.assertNotIn("expected_answer", payload)
        self.assertEqual(self.client.get("/api/practice/exercises/not-found").status_code, 404)
        self.assertEqual(self.client.get("/api/practice/exercises", params={"difficulty": "expert"}).status_code, 422)
        self.assertEqual(self.client.get("/api/practice/exercises", params={"status": "passed"}).status_code, 401)

    def test_practice_run_requires_auth_and_persists_monotonic_progress(self) -> None:
        slug = "filter-and-square"
        self.assertEqual(self.client.post(f"/api/practice/exercises/{slug}/run", json={"code": "def x(): pass"}).status_code, 401)
        auth = self.register()
        failed_code = "def filter_and_square(numbers, minimum):\n    return []\n"
        failed = self.client.post(f"/api/practice/exercises/{slug}/run", headers=auth["headers"], json={"code": failed_code})
        self.assertEqual(failed.status_code, 200, failed.text)
        self.assertFalse(failed.json()["passed"])
        self.assertEqual(failed.json()["progress"]["status"], "in_progress")
        self.assertEqual(failed.json()["progress"]["attempts"], 1)

        passed_code = "def filter_and_square(numbers, minimum):\n    return [value * value for value in numbers if value >= minimum]\n"
        passed = self.client.post(f"/api/practice/exercises/{slug}/run", headers=auth["headers"], json={"code": passed_code})
        self.assertEqual(passed.status_code, 200, passed.text)
        self.assertTrue(passed.json()["passed"], passed.text)
        self.assertEqual(passed.json()["progress"]["status"], "passed")

        again = self.client.post(f"/api/practice/exercises/{slug}/run", headers=auth["headers"], json={"code": failed_code})
        self.assertEqual(again.json()["progress"]["status"], "passed")
        self.assertEqual(again.json()["progress"]["attempts"], 3)
        resumed = self.client.get(f"/api/practice/exercises/{slug}", headers=auth["headers"]).json()
        self.assertEqual(resumed["starter_code"], failed_code)
        self.assertEqual(resumed["progress"]["last_code"], failed_code)

        status = self.client.get("/api/practice/exercises", headers=auth["headers"], params={"status": "passed", "page_size": 48})
        self.assertEqual(status.status_code, 200, status.text)
        self.assertIn(slug, [item["slug"] for item in status.json()["items"]])

    def test_legacy_submit_rejects_function_exercises(self) -> None:
        auth = self.register()
        with SessionLocal() as db:
            exercise = db.scalar(select(Exercise).where(Exercise.kind == "function"))
            exercise_id = exercise.id
        response = self.client.post(f"/api/exercises/{exercise_id}/submit", headers=auth["headers"], json={"answer": "x"})
        self.assertEqual(response.status_code, 404)

    def test_catalog_errors_and_assets_are_safe(self) -> None:
        self.assertEqual(self.client.get("/api/courses/999999").status_code, 404)
        self.assertEqual(self.client.get("/api/lessons/999999").status_code, 404)
        courses = self.client.get("/api/courses").json()
        second = self.client.get(f"/api/courses/{courses[1]['id']}").json()
        lesson = self.client.get(f"/api/lessons/{second['lessons'][0]['id']}").json()
        self.assertEqual(lesson["exercises"], [])

        asset = self.client.get("/api/course-assets/python-foundations/res/day01/tiobe_index.png")
        self.assertEqual(asset.status_code, 200)
        self.assertEqual(asset.headers["content-type"], "image/png")
        self.assertEqual(self.client.get("/api/course-assets/not-a-course/res/a.png").status_code, 404)
        self.assertEqual(self.client.get("/api/course-assets/python-foundations/%2E%2E/01.%E5%88%9D%E8%AF%86Python.md").status_code, 404)

    def test_execute_requires_auth(self) -> None:
        response = self.client.post("/api/execute", json={"code": "print(1)"})
        self.assertNotEqual(response.status_code, 200)
        self.assertEqual(response.status_code, 401)

    def test_execute_prints_stdout_when_authenticated(self) -> None:
        auth = self.register()
        marker = "pytrail-hello-stdout"
        response = self.client.post("/api/execute", json={"code": f"print({marker!r})"}, headers=auth["headers"])
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertTrue(body["ok"])
        self.assertIn(marker, body["stdout"])

    def test_execute_rejects_oversize_code(self) -> None:
        auth = self.register()
        response = self.client.post("/api/execute", json={"code": "x" * 4001}, headers=auth["headers"])
        self.assertEqual(response.status_code, 413)

    def test_execute_timeout_fails_closed(self) -> None:
        auth = self.register()
        response = self.client.post(
            "/api/execute",
            json={"code": "import time\ntime.sleep(5)"},
            headers=auth["headers"],
        )
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertFalse(body["ok"])
        self.assertIn("timed out", body["stderr"].lower())

    def test_login_burst_is_rate_limited(self) -> None:
        email = unique_email()
        self.register(email=email)
        statuses = [
            self.client.post("/api/auth/login", json={"email": email, "password": "wrong-password"}).status_code
            for _ in range(8)
        ]
        self.assertIn(429, statuses)
        self.assertTrue(any(code == 401 for code in statuses))

    def test_register_burst_is_rate_limited(self) -> None:
        statuses = [
            self.client.post(
                "/api/auth/register",
                json={"name": "Burst", "email": unique_email(), "password": "password123"},
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
            rows = db.scalars(select(Progress).where(Progress.user_id == auth["user"]["id"])).all()
            self.assertEqual(len(rows), 2)
            older = next(item for item in rows if item.lesson_id == second_id)
            older.updated_at = datetime.now(timezone.utc) - timedelta(days=1)
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
        self.assertEqual(compute_streak([today, today - timedelta(days=1)], today=today), 2)
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
        self.assertEqual(enforce_secret_key_policy(secret=unique, environment="production"), unique)
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            returned = enforce_secret_key_policy(secret=insecure, environment="development")
        self.assertEqual(returned, insecure)
        self.assertTrue(any(issubclass(item.category, UserWarning) for item in caught))


if __name__ == "__main__":
    unittest.main()
