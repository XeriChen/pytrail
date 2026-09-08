"""Local desktop mode: auto-provisioned user, config flag, persistence."""

from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as temp_database:
    _DB_PATH = Path(temp_database.name)
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_PATH.as_posix()}"
os.environ["SECRET_KEY"] = "local-mode-test-secret-key-0123456789"
os.environ["PYTRAIL_ENV"] = "development"
os.environ.pop("PYTRAIL_USERLESS_MODE", None)
os.environ.pop("PYTRAIL_LOCAL_MODE", None)

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app.auth import (  # noqa: E402
    LOCAL_MODE_ENV,
    LOCAL_USER_EMAIL,
    LOCAL_USER_NAME,
    LOCAL_USER_PASSWORD,
    USERLESS_MODE_ENV,
    is_local_mode,
)
from app.database import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import ExerciseProgress, User  # noqa: E402
from app.ratelimit import auth_limiter, practice_limiter  # noqa: E402

# Email that no code path creates; used to prove absent provisioning.
NOT_YET_EMAIL = "not-created@example.com"


class LocalModeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        with patch.dict(os.environ, {LOCAL_MODE_ENV: "1"}):
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

    def test_flag_detection_and_userless_precedence(self) -> None:
        with patch.dict(os.environ, {LOCAL_MODE_ENV: "1"}):
            self.assertTrue(is_local_mode())
        with patch.dict(os.environ, {LOCAL_MODE_ENV: "yes"}):
            self.assertTrue(is_local_mode())
        with patch.dict(os.environ, {LOCAL_MODE_ENV: ""}):
            self.assertFalse(is_local_mode())
        self.assertFalse(is_local_mode())
        with patch.dict(os.environ, {LOCAL_MODE_ENV: "1", USERLESS_MODE_ENV: "1"}):
            self.assertFalse(is_local_mode())

    def test_config_exposes_local_mode(self) -> None:
        with patch.dict(os.environ, {LOCAL_MODE_ENV: "1"}):
            body = self.client.get("/api/config").json()
            self.assertEqual(body, {"userless_mode": False, "local_mode": True}, body)
        body = self.client.get("/api/config").json()
        self.assertEqual(body, {"userless_mode": False, "local_mode": False}, body)

    def test_lifespan_creates_default_user_idempotently(self) -> None:
        with SessionLocal() as db:
            users = db.scalars(select(User).where(User.email == LOCAL_USER_EMAIL)).all()
        self.assertEqual(len(users), 1)
        self.assertEqual(users[0].name, LOCAL_USER_NAME)

        # A second lifespan run (app restart) must not duplicate the account.
        with (
            patch.dict(os.environ, {LOCAL_MODE_ENV: "1"}),
            TestClient(app) as client,
        ):
            self.assertEqual(client.get("/api/health").status_code, 200)
        with SessionLocal() as db:
            users = db.scalars(select(User).where(User.email == LOCAL_USER_EMAIL)).all()
        self.assertEqual(len(users), 1)

    def test_local_credentials_login_and_progress_persists(self) -> None:
        login = self.client.post(
            "/api/auth/login",
            json={"email": LOCAL_USER_EMAIL, "password": LOCAL_USER_PASSWORD},
        )
        self.assertEqual(login.status_code, 200, login.text)
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        self.assertEqual(
            self.client.get("/api/auth/me", headers=headers).status_code, 200
        )

        with SessionLocal() as db:
            user = db.scalar(select(User).where(User.email == LOCAL_USER_EMAIL))
            before = len(
                db.scalars(
                    select(ExerciseProgress).where(ExerciseProgress.user_id == user.id)
                ).all()
            )

        code = (
            "def filter_and_square(numbers, minimum):\n"
            "    return [number * number for number in numbers if number >= minimum]\n"
        )
        with patch.dict(os.environ, {LOCAL_MODE_ENV: "1"}):
            run = self.client.post(
                "/api/practice/exercises/filter-and-square/run",
                json={"code": code},
                headers=headers,
            )
        self.assertEqual(run.status_code, 200, run.text)
        self.assertTrue(run.json()["passed"])
        self.assertIsNotNone(run.json()["progress"])

        with SessionLocal() as db:
            after = len(
                db.scalars(
                    select(ExerciseProgress).where(ExerciseProgress.user_id == user.id)
                ).all()
            )
        self.assertEqual(after, before + 1)

        # Wrong password still fails; the account is not a bypass.
        bad = self.client.post(
            "/api/auth/login",
            json={"email": LOCAL_USER_EMAIL, "password": "wrong-password"},
        )
        self.assertEqual(bad.status_code, 401)

    def test_local_mode_login_uses_normal_auth_contract(self) -> None:
        """The fixed account goes through the normal login verification."""
        login = self.client.post(
            "/api/auth/login",
            json={"email": LOCAL_USER_EMAIL, "password": LOCAL_USER_PASSWORD},
        )
        self.assertEqual(login.status_code, 200, login.text)
        unknown = self.client.post(
            "/api/auth/login",
            json={"email": "missing@example.com", "password": "password123"},
        )
        self.assertEqual(unknown.status_code, 401)


class NoLocalModeTests(unittest.TestCase):
    def test_lifespan_skips_default_user_without_flag(self) -> None:
        """A fresh app start without the flag never creates the account."""
        with (
            patch.dict(os.environ, {LOCAL_MODE_ENV: ""}),
            TestClient(app) as client,
        ):
            self.assertEqual(client.get("/api/health").status_code, 200)
            with SessionLocal() as db:
                created = db.scalars(
                    select(User).where(User.email == NOT_YET_EMAIL)
                ).all()
        self.assertEqual(len(created), 0)


if __name__ == "__main__":
    unittest.main()
