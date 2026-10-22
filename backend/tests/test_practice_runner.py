from __future__ import annotations

import os
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from app.practice_runner import (
    DEFAULT_MAX_CONCURRENCY,
    DEFAULT_QUEUE_TIMEOUT_SECONDS,
    MAX_CONCURRENCY_ENV,
    PRACTICE_PYTHON_ENV,
    QUEUE_TIMEOUT_ENV,
    PracticeCaseInput,
    PracticeRunError,
    PracticeRunnerBusy,
    PracticeRunnerUnavailable,
    RunSlots,
    configured_run_slots,
    resolve_practice_python,
    run_practice,
    validate_source,
)

ADD_SOURCE = "def add(left, right):\n    return left + right\n"

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


def slot_is_free(slots: RunSlots) -> bool:
    """Probe a limit-1 gate without waiting; leaves it as it was found."""
    probe = RunSlots(slots.limit, 0)
    probe._semaphore = slots._semaphore
    try:
        with probe.hold():
            return True
    except PracticeRunnerBusy:
        return False


class RunSlotsTests(unittest.TestCase):
    def test_defaults_and_environment_overrides(self) -> None:
        with patch.dict(os.environ, {MAX_CONCURRENCY_ENV: "", QUEUE_TIMEOUT_ENV: ""}):
            slots = configured_run_slots()
        self.assertEqual(slots.limit, DEFAULT_MAX_CONCURRENCY)
        self.assertEqual(slots.limit, 20)
        self.assertEqual(slots.queue_timeout, DEFAULT_QUEUE_TIMEOUT_SECONDS)

        with patch.dict(
            os.environ, {MAX_CONCURRENCY_ENV: " 3 ", QUEUE_TIMEOUT_ENV: "0.5"}
        ):
            slots = configured_run_slots()
        self.assertEqual((slots.limit, slots.queue_timeout), (3, 0.5))

        with patch.dict(os.environ, {QUEUE_TIMEOUT_ENV: "0"}):
            self.assertEqual(configured_run_slots().queue_timeout, 0)

    def test_invalid_environment_values_fail_loudly(self) -> None:
        invalid = {
            MAX_CONCURRENCY_ENV: ["0", "-1", "2.5", "many"],
            QUEUE_TIMEOUT_ENV: ["-1", "nan", "inf", "soon"],
        }
        for name, values in invalid.items():
            for value in values:
                with (
                    self.subTest(name=name, value=value),
                    patch.dict(os.environ, {name: value}),
                    self.assertRaisesRegex(ValueError, name),
                ):
                    configured_run_slots()

    def test_excess_callers_queue_until_a_slot_frees(self) -> None:
        slots = RunSlots(1, 5.0)
        entered = threading.Event()
        finished: list[float] = []

        def queued() -> None:
            started = time.monotonic()
            with slots.hold():
                entered.set()
            finished.append(time.monotonic() - started)

        with slots.hold():
            waiter = threading.Thread(target=queued)
            waiter.start()
            self.assertFalse(entered.wait(0.2), "second caller must wait")
        waiter.join(2)
        self.assertTrue(entered.is_set())
        self.assertEqual(len(finished), 1)
        self.assertGreaterEqual(finished[0], 0.15)
        self.assertTrue(slot_is_free(slots))

    def test_queue_timeout_raises_busy(self) -> None:
        slots = RunSlots(1, 0.1)
        with slots.hold():
            started = time.monotonic()
            with self.assertRaises(PracticeRunnerBusy) as raised, slots.hold():
                self.fail("must not enter a full gate")
            waited = time.monotonic() - started
        self.assertGreaterEqual(waited, 0.09)
        self.assertLess(waited, 2)
        self.assertIsInstance(raised.exception, PracticeRunnerUnavailable)
        self.assertTrue(slot_is_free(slots))

    def test_slot_is_released_after_an_exception(self) -> None:
        slots = RunSlots(1, 0)
        with self.assertRaises(RuntimeError), slots.hold():
            raise RuntimeError("worker crashed")
        self.assertTrue(slot_is_free(slots))

    def test_never_exceeds_the_limit_under_contention(self) -> None:
        slots = RunSlots(2, 5.0)
        lock = threading.Lock()
        active = 0
        peak = 0

        def work() -> None:
            nonlocal active, peak
            with slots.hold():
                with lock:
                    active += 1
                    peak = max(peak, active)
                time.sleep(0.05)
                with lock:
                    active -= 1

        threads = [threading.Thread(target=work) for _ in range(8)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(5)
        self.assertEqual(peak, 2)
        self.assertEqual(active, 0)


class RunPracticeConcurrencyTests(unittest.TestCase):
    def test_full_gate_returns_busy_without_spawning_a_worker(self) -> None:
        slots = RunSlots(1, 0.05)
        with (
            patch("app.practice_runner.RUN_SLOTS", slots),
            patch("app.practice_runner.subprocess.run") as spawn,
            slots.hold(),
            self.assertRaises(PracticeRunnerBusy),
        ):
            run_practice(ADD_SOURCE, "add", ["left", "right"], CASES)
        spawn.assert_not_called()
        self.assertTrue(slot_is_free(slots))

    def test_rejected_source_never_takes_a_slot(self) -> None:
        slots = RunSlots(1, 0)
        with (
            patch("app.practice_runner.RUN_SLOTS", slots),
            slots.hold(),
            self.assertRaises(PracticeRunError),
        ):
            run_practice("import os\n" + ADD_SOURCE, "add", ["left", "right"], CASES)

    def test_slot_is_released_after_success_timeout_and_spawn_failure(self) -> None:
        slots = RunSlots(1, 0)
        with patch("app.practice_runner.RUN_SLOTS", slots):
            self.assertTrue(
                run_practice(ADD_SOURCE, "add", ["left", "right"], CASES)["passed"]
            )
            self.assertTrue(slot_is_free(slots))

            timed_out = run_practice(
                "def add(left, right):\n    while True: pass\n",
                "add",
                ["left", "right"],
                CASES,
                timeout=0.1,
            )
            self.assertIn("timed out", timed_out["error"])
            self.assertTrue(slot_is_free(slots))

            with (
                patch(
                    "app.practice_runner.subprocess.run",
                    side_effect=OSError("cannot spawn"),
                ),
                self.assertRaises(OSError),
            ):
                run_practice(ADD_SOURCE, "add", ["left", "right"], CASES)
            self.assertTrue(slot_is_free(slots))

    def test_queue_wait_does_not_shorten_the_execution_timeout(self) -> None:
        slots = RunSlots(1, 5.0)
        seen: list[float] = []

        def fake_run(*_args, **kwargs):
            seen.append(kwargs["timeout"])
            return subprocess.CompletedProcess([], 0, b"{}", b"")

        holder_ready = threading.Event()

        def hold_briefly() -> None:
            with slots.hold():
                holder_ready.set()
                time.sleep(0.2)

        holder = threading.Thread(target=hold_briefly)
        with (
            patch("app.practice_runner.RUN_SLOTS", slots),
            patch("app.practice_runner.subprocess.run", side_effect=fake_run),
            patch("app.practice_runner.is_frozen_build", return_value=False),
        ):
            holder.start()
            holder_ready.wait(2)
            run_practice(ADD_SOURCE, "add", ["left", "right"], CASES, timeout=1.5)
        holder.join(2)
        self.assertEqual(seen, [1.5])

    def test_frozen_worker_path_shares_the_same_gate(self) -> None:
        slots = RunSlots(1, 0.05)
        with (
            patch("app.practice_runner.RUN_SLOTS", slots),
            patch("app.practice_runner.is_frozen_build", return_value=True),
            patch("app.practice_runner.subprocess.run") as spawn,
            slots.hold(),
            self.assertRaises(PracticeRunnerBusy),
        ):
            run_practice(ADD_SOURCE, "add", ["left", "right"], CASES)
        spawn.assert_not_called()

        captured: dict = {}

        def fake_run(command, **kwargs):
            captured.update(command=command, **kwargs)
            return subprocess.CompletedProcess(command, 0, b"{}", b"")

        with (
            patch("app.practice_runner.RUN_SLOTS", slots),
            patch("app.practice_runner.is_frozen_build", return_value=True),
            patch("app.practice_runner.subprocess.run", side_effect=fake_run),
        ):
            run_practice(ADD_SOURCE, "add", ["left", "right"], CASES)
        self.assertEqual(
            captured["command"], [sys.executable, "--pytrail-practice-worker"]
        )
        self.assertEqual(captured["timeout"], 4.0)
        self.assertEqual(captured["env"], {"PATH": os.getenv("PATH", "")})
        self.assertTrue(slot_is_free(slots))


if __name__ == "__main__":
    unittest.main()
