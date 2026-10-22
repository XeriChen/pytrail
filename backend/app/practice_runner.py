"""Isolated runner for curated function exercises."""

from __future__ import annotations

import ast
import json
import math
import os
import shutil
import subprocess
import sys
import threading
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any

MAX_SOURCE_BYTES = 12_000
MAX_PAYLOAD_BYTES = 96_000
MAX_OUTPUT_BYTES = 96_000
RUN_TIMEOUT_SECONDS = 2.0
FROZEN_BOOT_ALLOWANCE_SECONDS = 2.0
PRACTICE_PYTHON_ENV = "PYTRAIL_PRACTICE_PYTHON"
WORKER_FLAG = "--pytrail-practice-worker"
MAX_CONCURRENCY_ENV = "PYTRAIL_PRACTICE_MAX_CONCURRENCY"
QUEUE_TIMEOUT_ENV = "PYTRAIL_PRACTICE_QUEUE_TIMEOUT"
DEFAULT_MAX_CONCURRENCY = 20
# A slot is held for at most the 2 s run timeout plus process spawn/teardown
# (4 s on frozen builds with the boot allowance), so 5 s of queueing covers
# about two full turnovers of every slot (one on frozen builds) while bounding
# how long a waiting request ties up a request thread before it gets a 503.
DEFAULT_QUEUE_TIMEOUT_SECONDS = 5.0


class PracticeRunError(ValueError):
    pass


class PracticeRunnerUnavailable(RuntimeError):
    pass


class PracticeRunnerBusy(PracticeRunnerUnavailable):
    """Every worker slot stayed taken for the whole queue timeout."""


class RunSlots:
    """Process-wide cap on concurrently running practice workers.

    Callers beyond the limit queue for up to `queue_timeout` seconds and then
    fail with `PracticeRunnerBusy`. Queueing happens before the worker starts,
    so it never eats into the submission's own execution timeout.
    """

    def __init__(self, limit: int, queue_timeout: float) -> None:
        if limit < 1:
            raise ValueError("limit must be at least 1")
        if queue_timeout < 0 or not math.isfinite(queue_timeout):
            raise ValueError("queue_timeout must be a finite number >= 0")
        self.limit = limit
        self.queue_timeout = queue_timeout
        self._semaphore = threading.BoundedSemaphore(limit)

    @contextmanager
    def hold(self) -> Iterator[None]:
        if not self._semaphore.acquire(timeout=self.queue_timeout):
            raise PracticeRunnerBusy(
                f"All {self.limit} practice runner slots stayed busy for "
                f"{self.queue_timeout:g} seconds"
            )
        try:
            yield
        finally:
            self._semaphore.release()


def _env_number(name: str, default: float, *, integer: bool, minimum: float) -> float:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw) if integer else float(raw)
    except ValueError:
        value = None
    if value is None or not math.isfinite(value) or value < minimum:
        kind = "an integer" if integer else "a number"
        raise ValueError(f"{name} must be {kind} >= {minimum:g}, got {raw!r}")
    return value


def configured_run_slots() -> RunSlots:
    """Build the run cap from the environment; invalid values fail at startup."""
    limit = _env_number(
        MAX_CONCURRENCY_ENV, DEFAULT_MAX_CONCURRENCY, integer=True, minimum=1
    )
    queue_timeout = _env_number(
        QUEUE_TIMEOUT_ENV, DEFAULT_QUEUE_TIMEOUT_SECONDS, integer=False, minimum=0
    )
    return RunSlots(int(limit), float(queue_timeout))


RUN_SLOTS = configured_run_slots()


@dataclass(frozen=True)
class PracticeCaseInput:
    args: list[Any]
    kwargs: dict[str, Any]
    expected: Any
    comparison: str = "exact"
    tolerance: float = 1e-6


BLOCKED_NODES = (
    ast.Import,
    ast.ImportFrom,
    ast.Global,
    ast.Nonlocal,
    ast.ClassDef,
    ast.AsyncFunctionDef,
    ast.Lambda,
    ast.With,
    ast.AsyncWith,
    ast.Try,
    ast.Raise,
)
BLOCKED_CALLS = frozenset(
    {
        "breakpoint",
        "compile",
        "delattr",
        "dir",
        "eval",
        "exec",
        "getattr",
        "globals",
        "help",
        "input",
        "locals",
        "open",
        "setattr",
        "type",
        "vars",
        "__import__",
    }
)


def failed_result(error: str, *, total_count: int) -> dict[str, Any]:
    """Build the run-result contract for a submission that never ran its cases."""
    return {
        "ok": False,
        "passed": False,
        "passed_count": 0,
        "total_count": total_count,
        "error": error,
        "cases": [],
    }


def resolve_practice_python() -> str:
    """Resolve the interpreter used by the restricted worker subprocess.

    The API interpreter remains the default. A deployment running directly on
    the host can temporarily select another local Python installation without
    invoking a shell or changing the worker's isolation flags.
    """
    configured = os.getenv(PRACTICE_PYTHON_ENV, "").strip()
    if not configured:
        return sys.executable

    expanded = os.path.expandvars(os.path.expanduser(configured))
    candidate = Path(expanded)
    if candidate.is_absolute() or candidate.parent != Path("."):
        resolved = candidate.resolve()
        if resolved.is_file():
            return str(resolved)
    else:
        executable = shutil.which(expanded)
        if executable:
            return executable

    raise PracticeRunnerUnavailable(
        f"{PRACTICE_PYTHON_ENV} does not point to a Python executable"
    )


def is_frozen_build() -> bool:
    """Return whether the API itself runs from a PyInstaller executable."""
    return bool(getattr(sys, "frozen", False))


def worker_command() -> list[str]:
    """Build the command that spawns the isolated practice worker.

    A frozen build has no on-disk worker script or separate interpreter, so
    the executable re-runs itself with the worker flag; `desktop.py` dispatches
    that flag before touching the API. The `-I` flag is dropped there because
    the embedded interpreter has no user site-packages to isolate away.
    """
    if is_frozen_build():
        return [sys.executable, WORKER_FLAG]
    worker = Path(__file__).with_name("practice_worker.py")
    return [resolve_practice_python(), "-I", str(worker)]


def worker_creationflags() -> int:
    """Suppress the console flash each worker spawn causes on windowed builds."""
    if sys.platform == "win32":
        return subprocess.CREATE_NO_WINDOW
    return 0


def validate_source(code: str, function_name: str, parameter_names: list[str]) -> None:
    if not code.strip():
        raise PracticeRunError("Code cannot be empty")
    if len(code.encode("utf-8")) > MAX_SOURCE_BYTES:
        raise PracticeRunError("Code is too long")
    try:
        tree = ast.parse(code, mode="exec")
    except SyntaxError as exc:
        message = exc.msg or "invalid syntax"
        raise PracticeRunError(
            f"Syntax error on line {exc.lineno or 1}: {message}"
        ) from exc

    target: ast.FunctionDef | None = None
    for node in ast.walk(tree):
        if isinstance(node, BLOCKED_NODES):
            raise PracticeRunError(f"{type(node).__name__} is not allowed")
        if isinstance(node, ast.Attribute) and node.attr.startswith("_"):
            raise PracticeRunError("Private attributes are not allowed")
        if isinstance(node, ast.Name):
            if node.id.startswith("__"):
                raise PracticeRunError("Private names are not allowed")
            if node.id in BLOCKED_CALLS:
                raise PracticeRunError(f"{node.id}() is not allowed")
        if isinstance(node, ast.FunctionDef) and node.name == function_name:
            if target is not None:
                raise PracticeRunError(f"Define {function_name} exactly once")
            target = node

    if target is None:
        raise PracticeRunError(f"Define the required function: {function_name}")
    args = target.args
    actual_names = [argument.arg for argument in args.args]
    if (
        actual_names != parameter_names
        or args.posonlyargs
        or args.kwonlyargs
        or args.vararg is not None
        or args.kwarg is not None
        or args.defaults
        or any(default is not None for default in args.kw_defaults)
    ):
        joined = ", ".join(parameter_names)
        raise PracticeRunError(f"Function signature must be {function_name}({joined})")


def run_practice(
    code: str,
    function_name: str,
    parameter_names: list[str],
    cases: list[PracticeCaseInput],
    timeout: float = RUN_TIMEOUT_SECONDS,
) -> dict[str, Any]:
    validate_source(code, function_name, parameter_names)
    payload = {
        "code": code,
        "function_name": function_name,
        "parameter_names": parameter_names,
        "cases": [
            {
                "args": case.args,
                "kwargs": case.kwargs,
                "expected": case.expected,
                "comparison": case.comparison,
                "tolerance": case.tolerance,
            }
            for case in cases
        ],
    }
    encoded = json.dumps(payload, ensure_ascii=False, allow_nan=False).encode("utf-8")
    if len(encoded) > MAX_PAYLOAD_BYTES:
        raise PracticeRunError("Exercise payload is too large")

    worker_timeout = timeout
    if is_frozen_build():
        # Exe bootstrap (including antivirus scans) is not user code; only the
        # remaining budget bounds the submission itself.
        worker_timeout = timeout + FROZEN_BOOT_ALLOWANCE_SECONDS
    command = worker_command()
    try:
        # Both the interpreter and the frozen-exe worker paths share this cap;
        # the slot is held only while the subprocess exists.
        with RUN_SLOTS.hold():
            completed = subprocess.run(
                command,
                input=encoded,
                capture_output=True,
                timeout=worker_timeout,
                env={"PATH": os.getenv("PATH", "")},
                check=False,
                creationflags=worker_creationflags(),
            )
    except subprocess.TimeoutExpired:
        return failed_result(
            f"Execution timed out after {timeout:g} seconds.", total_count=len(cases)
        )

    if len(completed.stdout) > MAX_OUTPUT_BYTES:
        raise PracticeRunnerUnavailable("Runner output exceeded the limit")
    if completed.returncode != 0:
        detail = completed.stderr.decode("utf-8", errors="replace")[-2_000:].strip()
        raise PracticeRunnerUnavailable(detail or "The isolated runner failed")
    try:
        result = json.loads(completed.stdout.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise PracticeRunnerUnavailable(
            "The isolated runner returned invalid output"
        ) from exc
    if not isinstance(result, dict):
        raise PracticeRunnerUnavailable("The isolated runner returned invalid output")
    return result
