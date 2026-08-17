"""Isolated runner for curated function exercises."""

from __future__ import annotations

import ast
import json
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

MAX_SOURCE_BYTES = 12_000
MAX_PAYLOAD_BYTES = 96_000
MAX_OUTPUT_BYTES = 96_000
RUN_TIMEOUT_SECONDS = 2.0
PRACTICE_PYTHON_ENV = "PYTRAIL_PRACTICE_PYTHON"


class PracticeRunError(ValueError):
    pass


class PracticeRunnerUnavailable(RuntimeError):
    pass


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

    worker = Path(__file__).with_name("practice_worker.py")
    try:
        completed = subprocess.run(
            [resolve_practice_python(), "-I", str(worker)],
            input=encoded,
            capture_output=True,
            timeout=timeout,
            env={"PATH": os.getenv("PATH", "")},
            check=False,
        )
    except subprocess.TimeoutExpired:
        return {
            "ok": False,
            "passed": False,
            "passed_count": 0,
            "total_count": len(cases),
            "error": f"Execution timed out after {timeout:g} seconds.",
            "cases": [],
        }

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
