from __future__ import annotations

from typing import Any

FEEDBACK_CATEGORIES = frozenset(
    {"all_passed", "wrong_output", "runtime_error", "validation_error"}
)


def classify_result(result: dict[str, Any]) -> str:
    """Return a stable UI category without claiming a full code diagnosis."""

    if bool(result.get("passed")):
        return "all_passed"

    error = str(result.get("error") or "")
    cases = result.get("cases")
    if not cases:
        return "validation_error" if _is_validation_error(error) else "runtime_error"
    if any(case.get("error") for case in cases if isinstance(case, dict)):
        return "runtime_error"
    return "wrong_output"


def _is_validation_error(error: str) -> bool:
    markers = (
        "Code cannot be empty",
        "Code is too long",
        "Syntax error",
        "Define the required function",
        "Define ",
        "Function signature must be",
        " is not allowed",
        "Exercise payload is too large",
    )
    return any(marker in error for marker in markers)
