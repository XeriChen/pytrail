from __future__ import annotations

import copy
import json
import tempfile
import unittest
from pathlib import Path

from app.course_sync import COURSE_SPECS, build_manifests
from app.practice_manifest import PracticeManifestError, load_practice_manifests

CONTENT_ROOT = Path(__file__).resolve().parents[1] / "content" / "python-100-days"
PRACTICE_ROOT = Path(__file__).resolve().parents[1] / "content" / "practice"


def lesson_sources() -> dict[str, set[str]]:
    return {
        manifest.spec.slug: {lesson.source_path for lesson in manifest.lessons}
        for manifest in build_manifests(CONTENT_ROOT)
    }


class ShippedPracticeManifestTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.records = load_practice_manifests(
            PRACTICE_ROOT,
            lesson_sources(),
            tuple(spec.slug for spec in COURSE_SPECS),
        )

    def test_shipped_manifests_cover_every_course(self) -> None:
        self.assertEqual(set(self.records), {spec.slug for spec in COURSE_SPECS})
        self.assertTrue(all(len(items) == 4 for items in self.records.values()))
        self.assertEqual(sum(len(items) for items in self.records.values()), 36)
        self.assertEqual(
            len({item.slug for items in self.records.values() for item in items}),
            36,
        )

    def test_every_seed_maps_to_a_real_lesson_and_has_public_cases(self) -> None:
        sources = lesson_sources()
        for course_slug, items in self.records.items():
            for item in items:
                self.assertIn(item.lesson_source_path, sources[course_slug])
                self.assertGreaterEqual(len(item.cases), 2)
                self.assertIn(item.difficulty, {"easy", "medium", "hard"})
                self.assertIn(f"def {item.function_name}(", item.starter_code)


class PracticeManifestValidationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.document = {
            "course_slug": "fixture",
            "exercises": [self._exercise(f"fixture-{index}") for index in range(1, 5)],
        }

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    @staticmethod
    def _exercise(slug: str) -> dict:
        return {
            "slug": slug,
            "lesson_source_path": "Day00/01.Fixture.md",
            "title": f"Fixture {slug}",
            "difficulty": "easy",
            "tags": ["lists"],
            "prompt": "实现 `solve(value)` 并返回输入值。",
            "function_name": "solve",
            "signature": {
                "parameters": [{"name": "value", "type": "int"}],
                "returns": "int",
            },
            "starter_code": "def solve(value: int) -> int:\n    return value\n",
            "cases": [
                {"args": [1], "expected": 1, "explanation": "正数"},
                {"args": [0], "expected": 0, "explanation": "零"},
            ],
        }

    def _write(self, document: dict | None = None) -> None:
        (self.root / "fixture.json").write_text(
            json.dumps(document or self.document, ensure_ascii=False),
            encoding="utf-8",
        )

    def _load(self):
        return load_practice_manifests(
            self.root,
            {"fixture": {"Day00/01.Fixture.md"}},
            ("fixture",),
        )

    def test_rejects_duplicate_slugs(self) -> None:
        broken = copy.deepcopy(self.document)
        broken["exercises"][1]["slug"] = broken["exercises"][0]["slug"]
        self._write(broken)
        with self.assertRaisesRegex(PracticeManifestError, "Duplicate exercise slug"):
            self._load()

    def test_rejects_unknown_lesson_source(self) -> None:
        broken = copy.deepcopy(self.document)
        broken["exercises"][0]["lesson_source_path"] = "Day00/missing.md"
        self._write(broken)
        with self.assertRaisesRegex(PracticeManifestError, "unknown lesson"):
            self._load()

    def test_rejects_invalid_function_and_argument_count(self) -> None:
        broken = copy.deepcopy(self.document)
        broken["exercises"][0]["function_name"] = "not-valid"
        self._write(broken)
        with self.assertRaisesRegex(PracticeManifestError, "function_name"):
            self._load()

        broken = copy.deepcopy(self.document)
        broken["exercises"][0]["cases"][0]["args"] = []
        self._write(broken)
        with self.assertRaisesRegex(PracticeManifestError, "arguments"):
            self._load()

    def test_rejects_invalid_case_contract(self) -> None:
        for mutation, message in (
            (("cases", []), "at least two public cases"),
            (("difficulty", "legendary"), "difficulty"),
            (("comparison", "unordered"), "comparison"),
        ):
            broken = copy.deepcopy(self.document)
            key, value = mutation
            if key == "comparison":
                broken["exercises"][0]["cases"][0][key] = value
            else:
                broken["exercises"][0][key] = value
            self._write(broken)
            with self.assertRaisesRegex(PracticeManifestError, message):
                self._load()

    def test_rejects_wrong_course_size_and_malformed_json(self) -> None:
        broken = copy.deepcopy(self.document)
        broken["exercises"].pop()
        self._write(broken)
        with self.assertRaisesRegex(PracticeManifestError, "exactly 4"):
            self._load()

        (self.root / "fixture.json").write_text("{broken", encoding="utf-8")
        with self.assertRaisesRegex(PracticeManifestError, "Invalid JSON"):
            self._load()


if __name__ == "__main__":
    unittest.main()
