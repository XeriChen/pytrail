"""Verify optional static frontend hosting without changing the shipped API app."""

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

from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import _mount_static_site  # noqa: E402


class StaticSiteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.static_dir = Path(self.temp_dir.name)
        (self.static_dir / "assets").mkdir()
        (self.static_dir / "index.html").write_text(
            "<main>PyTrail</main>", encoding="utf-8"
        )
        (self.static_dir / "assets" / "app.js").write_text(
            "console.log('ready')", encoding="utf-8"
        )
        with patch.dict(os.environ, {"PYTRAIL_STATIC_DIR": str(self.static_dir)}):
            site = FastAPI()
            _mount_static_site(site)
        self.client = TestClient(site)

    def tearDown(self) -> None:
        self.client.close()
        self.temp_dir.cleanup()

    def test_serves_root_assets_and_spa_routes(self) -> None:
        self.assertEqual(self.client.get("/").text, "<main>PyTrail</main>")
        asset = self.client.get("/assets/app.js")
        self.assertEqual(asset.status_code, 200)
        self.assertIn("javascript", asset.headers["content-type"])
        self.assertEqual(
            self.client.get("/practice/example").text, "<main>PyTrail</main>"
        )

    def test_preserves_api_404_and_rejects_static_path_escape(self) -> None:
        self.assertEqual(self.client.get("/api/missing").status_code, 404)
        self.assertEqual(self.client.get("/%2E%2E/secret.txt").status_code, 404)
