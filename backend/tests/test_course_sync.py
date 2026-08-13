from __future__ import annotations

import unittest
from pathlib import Path

from app.course_sync import COURSE_SPECS, build_manifests, reading_duration


CONTENT_ROOT = Path(__file__).resolve().parents[1] / "content" / "python-100-days"


class CourseManifestTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.manifests = build_manifests(CONTENT_ROOT)

    def test_catalog_has_exact_course_and_lesson_counts(self) -> None:
        self.assertEqual(len(COURSE_SPECS), 9)
        self.assertEqual(len(self.manifests), 9)
        self.assertEqual([len(item.lessons) for item in self.manifests], [20, 10, 3, 10, 15, 9, 15, 10, 10])
        self.assertEqual(sum(len(item.lessons) for item in self.manifests), 102)

    def test_special_numbering_is_preserved_and_naturally_sorted(self) -> None:
        language = self.manifests[2]
        self.assertEqual([item.filename for item in language.lessons], ["31.Python语言进阶.md", "32-33.Web前端入门.md", "34-35.玩转Linux操作系统.md"])
        scraping = self.manifests[5]
        numbered = [item.filename for item in scraping.lessons if item.filename.startswith(("62.", "63."))]
        self.assertEqual(len(numbered), 6)
        self.assertEqual(self.manifests[-1].lessons[-1].filename, "100.补充内容.md")
        self.assertEqual(self.manifests[-1].lessons[-1].title, "补充内容")

    def test_markdown_duration_assets_and_exercises_are_complete(self) -> None:
        lessons = [lesson for course in self.manifests for lesson in course.lessons]
        self.assertTrue(all(5 <= lesson.duration <= 90 for lesson in lessons))
        self.assertIn("初识Python", self.manifests[0].lessons[0].markdown.splitlines()[0])
        self.assertTrue(all(len(course.asset_digest) == 64 for course in self.manifests))
        self.assertEqual(sum(len(lesson.exercises) for lesson in lessons), 22)
        self.assertTrue(all(not lesson.exercises for course in self.manifests[1:] for lesson in course.lessons))
        self.assertFalse(any((CONTENT_ROOT / spec.slug / "code").exists() for spec in COURSE_SPECS))

    def test_reading_duration_clamps_to_bounds(self) -> None:
        self.assertEqual(reading_duration("short"), 5)
        self.assertEqual(reading_duration("x" * 3000), 6)
        self.assertEqual(reading_duration("x" * 100000), 90)


if __name__ == "__main__":
    unittest.main()
