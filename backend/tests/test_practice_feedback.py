from __future__ import annotations

import unittest

from app.practice_feedback import classify_result


class PracticeFeedbackTests(unittest.TestCase):
    def test_classifies_success_validation_runtime_and_wrong_output(self) -> None:
        self.assertEqual(classify_result({"passed": True}), "all_passed")
        self.assertEqual(
            classify_result(
                {"passed": False, "error": "Syntax error at line 1", "cases": []}
            ),
            "validation_error",
        )
        self.assertEqual(
            classify_result(
                {
                    "passed": False,
                    "error": None,
                    "cases": [{"passed": False, "error": "division by zero"}],
                }
            ),
            "runtime_error",
        )
        self.assertEqual(
            classify_result(
                {
                    "passed": False,
                    "error": None,
                    "cases": [{"passed": False, "actual": []}],
                }
            ),
            "wrong_output",
        )


if __name__ == "__main__":
    unittest.main()
