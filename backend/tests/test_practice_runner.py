from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.practice_runner import (
    PRACTICE_PYTHON_ENV,
    PracticeCaseInput,
    PracticeRunError,
    PracticeRunnerUnavailable,
    resolve_practice_python,
    run_practice,
    validate_source,
)

CASES = [
    PracticeCaseInput([2, 3], {}, 5),
    PracticeCaseInput([-2, 2], {}, 0),
]


class PracticeRunnerTests(unittest.TestCase):
    def test_runs_public_cases_in_isolated_worker(self) -> None:
        result = run_practice(
            "def add(left, right):\n    return left + right\n",
            "add",
            ["left", "right"],
            CASES,
        )
        self.assertTrue(result["passed"])
        self.assertEqual(result["passed_count"], 2)

    def test_reports_failed_values_and_runtime_errors(self) -> None:
        failed = run_practice(
            "def add(left, right):\n    return left - right\n",
            "add",
            ["left", "right"],
            CASES,
        )
        self.assertFalse(failed["passed"])
        self.assertEqual(failed["cases"][0]["actual"], -1)

        errored = run_practice(
            "def add(left, right):\n    return left / 0\n",
            "add",
            ["left", "right"],
            CASES,
        )
        self.assertIn("ZeroDivisionError", errored["cases"][0]["error"])

    def test_supports_common_collection_operations(self) -> None:
        code = """def normalize(values):
    result = []
    for index, value in enumerate(sorted(values)):
        result.append(value + index)
    return result
"""
        result = run_practice(
            code,
            "normalize",
            ["values"],
            [PracticeCaseInput([[3, 1, 2]], {}, [1, 3, 5])],
        )
        self.assertTrue(result["passed"], result)

    def test_type_annotations_do_not_require_runtime_builtins(self) -> None:
        code = "def wrap(value: object) -> list[object]:\n    return [value]\n"
        result = run_practice(
            code, "wrap", ["value"], [PracticeCaseInput([3], {}, [3])]
        )
        self.assertTrue(result["passed"], result)

    def test_worker_protocol_is_utf8_for_non_ascii_results(self) -> None:
        result = run_practice(
            "def echo(value):\n    return value\n",
            "echo",
            ["value"],
            [PracticeCaseInput(["中文样例"], {}, "中文样例")],
        )
        self.assertTrue(result["passed"], result)

    def test_resolves_configured_local_python(self) -> None:
        with patch.dict(os.environ, {PRACTICE_PYTHON_ENV: sys.executable}):
            self.assertEqual(
                resolve_practice_python(), str(Path(sys.executable).resolve())
            )

        with tempfile.TemporaryDirectory() as directory:
            missing = Path(directory) / "missing-python"
            with (
                patch.dict(os.environ, {PRACTICE_PYTHON_ENV: str(missing)}),
                self.assertRaisesRegex(PracticeRunnerUnavailable, PRACTICE_PYTHON_ENV),
            ):
                resolve_practice_python()

    def test_rejects_unsafe_syntax_and_wrong_signatures(self) -> None:
        blocked = {
            "import os\ndef add(left, right): return left + right": "Import",
            "def add(left, right): return open('x')": "open()",
            "def add(left, right):\n    setter = setattr\n    return setter(left, 'x', right)": "setattr()",
            "def add(left, right): return left.__class__": "Private attributes",
            "def add(value): return value": "signature",
        }
        for source, message in blocked.items():
            with (
                self.subTest(source=source),
                self.assertRaisesRegex(PracticeRunError, message),
            ):
                validate_source(source, "add", ["left", "right"])

    def test_timeout_is_fail_closed(self) -> None:
        result = run_practice(
            "def add(left, right):\n    while True: pass\n",
            "add",
            ["left", "right"],
            CASES,
            timeout=0.1,
        )
        self.assertFalse(result["ok"])
        self.assertIn("timed out", result["error"])


if __name__ == "__main__":
    unittest.main()
