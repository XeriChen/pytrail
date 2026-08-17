"""RestrictedPython worker. Communicates with the API process over JSON stdio."""

from __future__ import annotations
import __future__

import json
import math
import sys
import time
from typing import Any

from RestrictedPython import compile_restricted
from RestrictedPython.Eval import default_guarded_getitem, default_guarded_getiter
from RestrictedPython.Guards import (
    full_write_guard,
    guarded_iter_unpack_sequence,
    guarded_unpack_sequence,
    safe_builtins,
    safer_getattr,
)


def _apply_host_limits() -> None:
    try:
        import resource
    except ImportError:
        return
    memory_bytes = 256 * 1024 * 1024
    resource.setrlimit(resource.RLIMIT_AS, (memory_bytes, memory_bytes))
    resource.setrlimit(resource.RLIMIT_CPU, (2, 2))
    resource.setrlimit(resource.RLIMIT_NOFILE, (8, 8))


def _inplace(operation: str, left: Any, right: Any) -> Any:
    operators = {
        "+=": lambda: left + right,
        "-=": lambda: left - right,
        "*=": lambda: left * right,
        "/=": lambda: left / right,
        "//=": lambda: left // right,
        "%=": lambda: left % right,
        "**=": lambda: left**right,
        "<<=": lambda: left << right,
        ">>=": lambda: left >> right,
        "&=": lambda: left & right,
        "^=": lambda: left ^ right,
        "|=": lambda: left | right,
    }
    if operation not in operators:
        raise ValueError("Unsupported in-place operation")
    return operators[operation]()


def _matches(actual: Any, expected: Any, comparison: str, tolerance: float) -> bool:
    if comparison == "approximate":
        if isinstance(actual, bool) or isinstance(expected, bool):
            return actual == expected
        if isinstance(actual, (int, float)) and isinstance(expected, (int, float)):
            return math.isclose(actual, expected, rel_tol=tolerance, abs_tol=tolerance)
        if (
            isinstance(actual, list)
            and isinstance(expected, list)
            and len(actual) == len(expected)
        ):
            return all(
                _matches(left, right, comparison, tolerance)
                for left, right in zip(actual, expected, strict=True)
            )
        if (
            isinstance(actual, dict)
            and isinstance(expected, dict)
            and actual.keys() == expected.keys()
        ):
            return all(
                _matches(actual[key], expected[key], comparison, tolerance)
                for key in actual
            )
    return actual == expected and type(actual) is type(expected)


def _json_safe(value: Any) -> Any:
    encoded = json.dumps(value, ensure_ascii=False, allow_nan=False)
    if len(encoded.encode("utf-8")) > 16_000:
        raise ValueError("Result is too large")
    return json.loads(encoded)


def _emit(payload: dict[str, Any]) -> None:
    encoded = json.dumps(payload, ensure_ascii=False, allow_nan=False).encode("utf-8")
    sys.stdout.buffer.write(encoded)


def _namespace() -> dict[str, Any]:
    builtins = dict(safe_builtins)
    builtins.pop("setattr", None)
    builtins.pop("delattr", None)
    builtins.update(
        {
            "all": all,
            "any": any,
            "dict": dict,
            "enumerate": enumerate,
            "filter": filter,
            "list": list,
            "map": map,
            "max": max,
            "min": min,
            "set": set,
            "sum": sum,
        }
    )
    return {
        "__builtins__": builtins,
        "_getattr_": safer_getattr,
        "_getitem_": default_guarded_getitem,
        "_getiter_": default_guarded_getiter,
        "_iter_unpack_sequence_": guarded_iter_unpack_sequence,
        "_unpack_sequence_": guarded_unpack_sequence,
        "_inplacevar_": _inplace,
        "_write_": full_write_guard,
    }


def main() -> None:
    _apply_host_limits()
    payload = json.loads(sys.stdin.buffer.read().decode("utf-8"))
    code = compile_restricted(
        payload["code"],
        filename="<submission>",
        mode="exec",
        flags=__future__.annotations.compiler_flag,
    )
    namespace = _namespace()
    exec(code, namespace)
    function = namespace[payload["function_name"]]

    results: list[dict[str, Any]] = []
    for position, case in enumerate(payload["cases"], start=1):
        expected = case["expected"]
        started = time.perf_counter()
        try:
            actual = _json_safe(function(*case["args"], **case["kwargs"]))
            passed = _matches(actual, expected, case["comparison"], case["tolerance"])
            results.append(
                {
                    "order": position,
                    "passed": passed,
                    "actual": actual,
                    "expected": expected,
                    "duration_ms": round((time.perf_counter() - started) * 1000, 3),
                }
            )
        except Exception as exc:
            results.append(
                {
                    "order": position,
                    "passed": False,
                    "expected": expected,
                    "error": f"{type(exc).__name__}: {exc}",
                    "duration_ms": round((time.perf_counter() - started) * 1000, 3),
                }
            )
            break

    passed_count = sum(item["passed"] for item in results)
    passed = len(results) == len(payload["cases"]) and passed_count == len(
        payload["cases"]
    )
    _emit(
        {
            "ok": True,
            "passed": passed,
            "passed_count": passed_count,
            "total_count": len(payload["cases"]),
            "error": None,
            "cases": results,
        }
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        _emit(
            {
                "ok": False,
                "passed": False,
                "passed_count": 0,
                "total_count": 0,
                "error": f"{type(exc).__name__}: {exc}",
                "cases": [],
            }
        )
