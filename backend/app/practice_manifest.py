"""Validation and immutable seeds for curated programming exercises."""

from __future__ import annotations

import json
import keyword
import re
from collections.abc import Collection, Iterable, Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
DIFFICULTIES = frozenset({"easy", "medium", "hard"})
COMPARISONS = frozenset({"exact", "approximate"})
MAX_CASE_BYTES = 8_000
MAX_PROMPT_CHARS = 20_000
MAX_STARTER_CHARS = 12_000
MAX_HINT_CHARS = 4_000
MAX_HINTS = 3


class PracticeManifestError(RuntimeError):
    pass


@dataclass(frozen=True)
class ParameterSeed:
    name: str
    type: str


@dataclass(frozen=True)
class FunctionSignatureSeed:
    parameters: tuple[ParameterSeed, ...]
    returns: str


@dataclass(frozen=True)
class PracticeCaseSeed:
    args: tuple[Any, ...]
    kwargs: dict[str, Any]
    expected: Any
    explanation: str
    comparison: str = "exact"
    tolerance: float = 1e-6


@dataclass(frozen=True)
class PracticeExerciseSeed:
    course_slug: str
    lesson_source_path: str
    slug: str
    title: str
    difficulty: str
    tags: tuple[str, ...]
    prompt: str
    function_name: str
    signature: FunctionSignatureSeed
    starter_code: str
    hints: tuple[str, ...]
    cases: tuple[PracticeCaseSeed, ...]


def default_practice_root() -> Path:
    return Path(__file__).resolve().parents[1] / "content" / "practice"


def _reject_json_constant(value: str) -> None:
    raise ValueError(f"Unsupported JSON constant: {value}")


def _read_document(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise PracticeManifestError(f"Missing practice manifest: {path}")
    try:
        value = json.loads(
            path.read_text(encoding="utf-8"), parse_constant=_reject_json_constant
        )
    except (OSError, UnicodeDecodeError, json.JSONDecodeError, ValueError) as exc:
        raise PracticeManifestError(
            f"Invalid JSON in practice manifest {path}: {exc}"
        ) from exc
    if not isinstance(value, dict):
        raise PracticeManifestError(f"Practice manifest must be an object: {path}")
    return value


def _required_text(value: Any, field: str, context: str, maximum: int = 512) -> str:
    if not isinstance(value, str) or not value.strip():
        raise PracticeManifestError(f"{context}: {field} must be a non-empty string")
    if len(value) > maximum:
        raise PracticeManifestError(f"{context}: {field} exceeds {maximum} characters")
    return value


def _parse_signature(value: Any, context: str) -> FunctionSignatureSeed:
    if not isinstance(value, dict):
        raise PracticeManifestError(f"{context}: signature must be an object")
    raw_parameters = value.get("parameters")
    if not isinstance(raw_parameters, list) or len(raw_parameters) > 8:
        raise PracticeManifestError(
            f"{context}: signature.parameters must contain at most 8 items"
        )
    parameters: list[ParameterSeed] = []
    names: set[str] = set()
    for position, raw in enumerate(raw_parameters, start=1):
        item_context = f"{context}: parameter {position}"
        if not isinstance(raw, dict):
            raise PracticeManifestError(f"{item_context} must be an object")
        name = _required_text(raw.get("name"), "name", item_context, 80)
        type_name = _required_text(raw.get("type"), "type", item_context, 120)
        if not name.isidentifier() or keyword.iskeyword(name) or name.startswith("_"):
            raise PracticeManifestError(
                f"{item_context}: invalid parameter name {name!r}"
            )
        if name in names:
            raise PracticeManifestError(f"{context}: duplicate parameter name {name!r}")
        names.add(name)
        parameters.append(ParameterSeed(name, type_name))
    returns = _required_text(value.get("returns"), "signature.returns", context, 160)
    return FunctionSignatureSeed(tuple(parameters), returns)


def _parse_case(
    value: Any, signature: FunctionSignatureSeed, context: str
) -> PracticeCaseSeed:
    if not isinstance(value, dict):
        raise PracticeManifestError(f"{context}: case must be an object")
    raw_args = value.get("args")
    raw_kwargs = value.get("kwargs", {})
    if not isinstance(raw_args, list) or not isinstance(raw_kwargs, dict):
        raise PracticeManifestError(
            f"{context}: args must be an array and kwargs must be an object"
        )
    names = [parameter.name for parameter in signature.parameters]
    if len(raw_args) > len(names):
        raise PracticeManifestError(
            f"{context}: arguments do not match the function signature"
        )
    remaining = set(names[len(raw_args) :])
    if set(raw_kwargs) != remaining:
        raise PracticeManifestError(
            f"{context}: arguments do not match the function signature"
        )
    try:
        payload_size = len(
            json.dumps(value, ensure_ascii=False, allow_nan=False).encode("utf-8")
        )
    except (TypeError, ValueError) as exc:
        raise PracticeManifestError(
            f"{context}: case values must be JSON-safe"
        ) from exc
    if payload_size > MAX_CASE_BYTES:
        raise PracticeManifestError(f"{context}: case exceeds {MAX_CASE_BYTES} bytes")
    if "expected" not in value:
        raise PracticeManifestError(f"{context}: expected is required")
    explanation = value.get("explanation", "")
    if not isinstance(explanation, str) or len(explanation) > 2_000:
        raise PracticeManifestError(
            f"{context}: explanation must be a string up to 2000 characters"
        )
    comparison = value.get("comparison", "exact")
    if comparison not in COMPARISONS:
        raise PracticeManifestError(f"{context}: invalid comparison {comparison!r}")
    tolerance = value.get("tolerance", 1e-6)
    if (
        isinstance(tolerance, bool)
        or not isinstance(tolerance, (int, float))
        or not 0 < tolerance <= 1
    ):
        raise PracticeManifestError(
            f"{context}: tolerance must be greater than 0 and at most 1"
        )
    return PracticeCaseSeed(
        tuple(raw_args),
        dict(raw_kwargs),
        value["expected"],
        explanation,
        comparison,
        float(tolerance),
    )


def _parse_exercise(
    value: Any,
    course_slug: str,
    sources: Collection[str],
    path: Path,
) -> PracticeExerciseSeed:
    if not isinstance(value, dict):
        raise PracticeManifestError(f"{path}: every exercise must be an object")
    slug_value = value.get("slug")
    context = f"{path} [{slug_value or 'unknown exercise'}]"
    slug = _required_text(slug_value, "slug", context, 180)
    if not SLUG_RE.fullmatch(slug):
        raise PracticeManifestError(
            f"{context}: slug must use lowercase words separated by hyphens"
        )
    lesson_source_path = _required_text(
        value.get("lesson_source_path"), "lesson_source_path", context, 512
    )
    if lesson_source_path not in sources:
        raise PracticeManifestError(f"{context}: unknown lesson {lesson_source_path!r}")
    title = _required_text(value.get("title"), "title", context, 180)
    difficulty = value.get("difficulty")
    if difficulty not in DIFFICULTIES:
        raise PracticeManifestError(f"{context}: invalid difficulty {difficulty!r}")
    raw_tags = value.get("tags")
    if not isinstance(raw_tags, list) or not 1 <= len(raw_tags) <= 6:
        raise PracticeManifestError(f"{context}: tags must contain 1 to 6 slugs")
    tags: list[str] = []
    for raw_tag in raw_tags:
        tag = _required_text(raw_tag, "tag", context, 80)
        if not SLUG_RE.fullmatch(tag) or tag in tags:
            raise PracticeManifestError(f"{context}: invalid or duplicate tag {tag!r}")
        tags.append(tag)
    prompt = _required_text(value.get("prompt"), "prompt", context, MAX_PROMPT_CHARS)
    function_name = _required_text(
        value.get("function_name"), "function_name", context, 80
    )
    if (
        not function_name.isidentifier()
        or keyword.iskeyword(function_name)
        or function_name.startswith("_")
    ):
        raise PracticeManifestError(
            f"{context}: invalid function_name {function_name!r}"
        )
    signature = _parse_signature(value.get("signature"), context)
    starter_code = _required_text(
        value.get("starter_code"), "starter_code", context, MAX_STARTER_CHARS
    )
    if f"def {function_name}(" not in starter_code:
        raise PracticeManifestError(
            f"{context}: starter_code must define {function_name}"
        )
    raw_hints = value.get("hints")
    if not isinstance(raw_hints, list) or len(raw_hints) != MAX_HINTS:
        raise PracticeManifestError(
            f"{context}: hints must contain exactly {MAX_HINTS} items"
        )
    hints = tuple(
        _required_text(raw_hint, "text", f"{context}: hint {position}", MAX_HINT_CHARS)
        for position, raw_hint in enumerate(raw_hints, start=1)
    )
    raw_cases = value.get("cases")
    if not isinstance(raw_cases, list) or not 2 <= len(raw_cases) <= 8:
        raise PracticeManifestError(
            f"{context}: at least two public cases and at most eight are required"
        )
    cases = tuple(
        _parse_case(raw_case, signature, f"{context}: case {position}")
        for position, raw_case in enumerate(raw_cases, start=1)
    )
    return PracticeExerciseSeed(
        course_slug,
        lesson_source_path,
        slug,
        title,
        difficulty,
        tuple(tags),
        prompt,
        function_name,
        signature,
        starter_code,
        hints,
        cases,
    )


def load_practice_manifests(
    root: Path,
    lesson_sources: Mapping[str, Collection[str]],
    course_slugs: Iterable[str],
) -> dict[str, tuple[PracticeExerciseSeed, ...]]:
    """Load all expected course manifests only after validating the full set."""

    directory = Path(root).resolve()
    expected = tuple(course_slugs)
    expected_set = set(expected)
    if len(expected_set) != len(expected):
        raise PracticeManifestError("Duplicate expected course slug")
    if not directory.is_dir():
        raise PracticeManifestError(f"Missing practice manifest directory: {directory}")
    present = {path.stem for path in directory.glob("*.json")}
    if present != expected_set:
        missing = sorted(expected_set - present)
        unexpected = sorted(present - expected_set)
        raise PracticeManifestError(
            f"Practice manifest set mismatch; missing={missing}, unexpected={unexpected}"
        )

    result: dict[str, tuple[PracticeExerciseSeed, ...]] = {}
    seen_slugs: set[str] = set()
    for course_slug in expected:
        path = directory / f"{course_slug}.json"
        document = _read_document(path)
        if document.get("course_slug") != course_slug:
            raise PracticeManifestError(f"{path}: course_slug must be {course_slug!r}")
        raw_exercises = document.get("exercises")
        if not isinstance(raw_exercises, list) or len(raw_exercises) != 4:
            raise PracticeManifestError(
                f"{path}: each course must contain exactly 4 exercises"
            )
        if course_slug not in lesson_sources:
            raise PracticeManifestError(
                f"{path}: no discovered lessons for course {course_slug}"
            )
        exercises = tuple(
            _parse_exercise(item, course_slug, lesson_sources[course_slug], path)
            for item in raw_exercises
        )
        for exercise in exercises:
            if exercise.slug in seen_slugs:
                raise PracticeManifestError(f"Duplicate exercise slug: {exercise.slug}")
            seen_slugs.add(exercise.slug)
        result[course_slug] = exercises
    return result
