# Lightweight Practice Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an independent 36-exercise Python function practice library linked to exact course lessons, with public catalog/detail pages, authenticated public-case execution, and lightweight persistent progress.

**Architecture:** Extend the existing `Exercise` aggregate with explicit quick-check and function kinds, public cases, normalized tags, and one current progress row per learner. Load curated JSON manifests into the course synchronizer using stable course/lesson/exercise keys, expose practice-specific FastAPI endpoints backed by a restricted child-process runner, and add `/practice` plus `/practice/:slug` React routes with a catalog and responsive split workspace.

**Tech Stack:** Python 3.14, FastAPI 0.141, SQLAlchemy 2.0, Pydantic 2, RestrictedPython, SQLite/PostgreSQL, React 19, TypeScript 7, React Router, CodeMirror 6, Vitest, Testing Library, Lucide.

## Global Constraints

- Keep the existing `POST /api/exercises/{id}/submit` quick-check contract and course reader behavior compatible.
- Store exactly 36 function exercises, four for each of the nine registered courses, and link each to one exact lesson source path.
- Function arguments and return values must be JSON-safe; use only public examples and standard-library concepts.
- Browsing is public; running and progress require authentication.
- Persist only current status, attempts, last code, and update time; do not add submission history.
- A passed exercise never returns to in-progress after a later failed run.
- Imports, files, network, processes, dynamic evaluation, and application secrets are unavailable to learner code.
- All new interface icons come from Lucide; no emoji or handwritten UI SVG.
- Preserve existing light/dark themes, reduced-motion handling, localization, and responsive behavior.
- Use `apply_patch` for manual edits, preserve unrelated worktree changes, and finish each task with its focused verification and commit.

---

### Task 1: Add Versioned Practice Schema

**Files:**
- Create: `backend/app/schema_migrations.py`
- Create: `backend/tests/test_schema_migrations.py`
- Modify: `backend/app/models.py`
- Modify: `backend/app/main.py`

**Interfaces:**
- Produces: `upgrade_schema(engine: Engine) -> None`, invoked before startup sync.
- Produces: `Lesson.source_path`, extended `Exercise`, `ExerciseCase`, `Tag`, `exercise_tags`, and `ExerciseProgress` ORM mappings.
- Consumes: existing `Base`, `engine`, and SQLAlchemy metadata.

- [ ] **Step 1: Write migration and model tests**

Create a legacy SQLite schema from the pre-feature table definitions, insert a user/course/lesson/quick-check/progress row, call `upgrade_schema`, then assert the original IDs/data remain and the following columns/tables exist:

```python
def test_upgrade_adds_practice_schema_without_losing_legacy_rows(self):
    upgrade_schema(self.engine)
    columns = {item["name"] for item in inspect(self.engine).get_columns("exercises")}
    self.assertTrue({"slug", "kind", "title", "difficulty", "function_name", "signature_json", "order"} <= columns)
    self.assertTrue({"exercise_cases", "tags", "exercise_tags", "exercise_progress", "schema_migrations"} <= set(inspect(self.engine).get_table_names()))
    self.assertEqual(self.connection.scalar(text("select count(*) from users")), 1)
    self.assertEqual(self.connection.scalar(text("select count(*) from progress")), 1)

def test_upgrade_is_idempotent(self):
    upgrade_schema(self.engine)
    upgrade_schema(self.engine)
    self.assertEqual(self.connection.scalar(text("select count(*) from schema_migrations")), 1)
```

- [ ] **Step 2: Run the migration tests and verify failure**

Run: `cd backend; uv run python -m unittest tests.test_schema_migrations -v`

Expected: FAIL because the migration module and practice model fields do not exist.

- [ ] **Step 3: Extend the SQLAlchemy model graph**

Add mappings with these exact boundaries:

```python
class Exercise(Base):
    __tablename__ = "exercises"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lesson_id: Mapped[int] = mapped_column(ForeignKey("lessons.id"))
    slug: Mapped[str | None] = mapped_column(String(180), unique=True, index=True, nullable=True)
    kind: Mapped[str] = mapped_column(String(24), default="quick_check", index=True)
    title: Mapped[str] = mapped_column(String(180), default="")
    difficulty: Mapped[str | None] = mapped_column(String(20), nullable=True)
    function_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    signature_json: Mapped[str] = mapped_column(Text, default="{}")
    order: Mapped[int] = mapped_column(Integer, default=1)
    prompt: Mapped[str] = mapped_column(Text)
    starter_code: Mapped[str] = mapped_column(Text, default="")
    expected_answer: Mapped[str] = mapped_column(String(160), default="")

class ExerciseCase(Base):
    __tablename__ = "exercise_cases"
    __table_args__ = (UniqueConstraint("exercise_id", "order", name="uq_exercise_case_order"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    exercise_id: Mapped[int] = mapped_column(ForeignKey("exercises.id", ondelete="CASCADE"), index=True)
    order: Mapped[int] = mapped_column(Integer)
    args_json: Mapped[str] = mapped_column(Text)
    kwargs_json: Mapped[str] = mapped_column(Text, default="{}")
    expected_json: Mapped[str] = mapped_column(Text)
    explanation: Mapped[str] = mapped_column(Text, default="")
    comparison: Mapped[str] = mapped_column(String(20), default="exact")
    tolerance: Mapped[float] = mapped_column(Float, default=1e-6)

class ExerciseProgress(Base):
    __tablename__ = "exercise_progress"
    __table_args__ = (UniqueConstraint("user_id", "exercise_id", name="uq_exercise_progress_user_exercise"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    exercise_id: Mapped[int] = mapped_column(ForeignKey("exercises.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="in_progress")
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    last_code: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
```

Add `Lesson.source_path`, bidirectional relationships, `Tag(slug, label_zh, label_en)`, and the `exercise_tags` association table. Use cascade delete-orphan for cases and exercise progress only when the owning stable exercise is intentionally removed.

- [ ] **Step 4: Implement the idempotent schema upgrader**

Create `schema_migrations` through SQLAlchemy, inspect columns before each additive `ALTER TABLE`, render column DDL with SQLAlchemy's active dialect, then create indexes/tables with `checkfirst=True`. Record migration version `1` only after success:

```python
PRACTICE_SCHEMA_VERSION = 1

def upgrade_schema(engine: Engine) -> None:
    Base.metadata.create_all(engine)
    with engine.begin() as connection:
        applied = set(connection.scalars(text("select version from schema_migrations")))
        if PRACTICE_SCHEMA_VERSION in applied:
            return
        add_column_if_missing(connection, "lessons", Column("source_path", String(512), nullable=True))
        add_column_if_missing(connection, "exercises", Column("slug", String(180), nullable=True))
        add_column_if_missing(connection, "exercises", Column("kind", String(24), nullable=False, server_default="quick_check"))
        add_column_if_missing(connection, "exercises", Column("title", String(180), nullable=False, server_default=""))
        add_column_if_missing(connection, "exercises", Column("difficulty", String(20), nullable=True))
        add_column_if_missing(connection, "exercises", Column("function_name", String(80), nullable=True))
        add_column_if_missing(connection, "exercises", Column("signature_json", Text, nullable=False, server_default="{}"))
        add_column_if_missing(connection, "exercises", Column("order", Integer, nullable=False, server_default="1"))
        connection.execute(insert(schema_migrations).values(version=PRACTICE_SCHEMA_VERSION))
```

Call `upgrade_schema(engine)` at the start of the FastAPI lifespan before `sync_courses`.

- [ ] **Step 5: Run focused and existing backend tests**

Run: `cd backend; uv run python -m unittest tests.test_schema_migrations tests.test_api -v`

Expected: migration tests PASS and existing API tests remain PASS.

- [ ] **Step 6: Commit schema work**

```text
git add backend/app/models.py backend/app/schema_migrations.py backend/app/main.py backend/tests/test_schema_migrations.py
git commit -m "feat: add versioned practice schema"
```

### Task 2: Define and Validate 36 Curriculum Exercises

**Files:**
- Create: `backend/app/practice_manifest.py`
- Create: `backend/content/practice/python-foundations.json`
- Create: `backend/content/practice/python-essentials.json`
- Create: `backend/content/practice/python-language-and-linux.json`
- Create: `backend/content/practice/databases-and-sql.json`
- Create: `backend/content/practice/web-development-with-django.json`
- Create: `backend/content/practice/web-scraping.json`
- Create: `backend/content/practice/data-analysis.json`
- Create: `backend/content/practice/machine-learning.json`
- Create: `backend/content/practice/projects-and-production.json`
- Create: `backend/tests/test_practice_manifest.py`

**Interfaces:**
- Produces: `PracticeExerciseSeed`, `PracticeCaseSeed`, and `load_practice_manifests(root: Path, lessons: Iterable[LessonRecord], specs: Iterable[CourseSpec]) -> dict[str, tuple[PracticeExerciseSeed, ...]]`.
- Consumes: stable `LessonRecord.source_path` values from course discovery.

- [ ] **Step 1: Write manifest contract tests**

```python
def test_shipped_manifests_cover_every_course(self):
    records = load_practice_manifests(PRACTICE_ROOT, self.lessons, COURSE_SPECS)
    self.assertEqual(set(records), {spec.slug for spec in COURSE_SPECS})
    self.assertTrue(all(len(items) == 4 for items in records.values()))
    self.assertEqual(sum(map(len, records.values())), 36)
    self.assertEqual(len({item.slug for items in records.values() for item in items}), 36)

def test_every_seed_maps_to_a_real_lesson_and_has_public_cases(self):
    for items in self.records.values():
        for item in items:
            self.assertIn(item.lesson_source_path, self.lesson_sources)
            self.assertGreaterEqual(len(item.cases), 2)
            self.assertIn(item.difficulty, {"easy", "medium", "hard"})
```

Add invalid-fixture tests for duplicate slugs, unknown lesson paths, missing cases, invalid function names, argument-count mismatch, non-JSON values, invalid comparison modes, oversized case payloads, and a course count other than four.

- [ ] **Step 2: Run manifest tests and verify failure**

Run: `cd backend; uv run python -m unittest tests.test_practice_manifest -v`

Expected: FAIL because the loader and manifests do not exist.

- [ ] **Step 3: Implement structured manifest parsing**

Use dataclasses plus `json.loads`, validate the complete document before returning immutable seeds, and report filename plus exercise slug in every error. The JSON shape is:

```json
{
  "course_slug": "python-foundations",
  "exercises": [
    {
      "slug": "prime-range-summary",
      "lesson_source_path": "Day01-20/07.分支和循环结构实战.md",
      "title": "区间质数统计",
      "difficulty": "easy",
      "tags": ["loops", "conditions"],
      "prompt": "实现 `prime_summary(start, end)`，返回闭区间内的质数列表与数量。",
      "function_name": "prime_summary",
      "signature": {
        "parameters": [{"name": "start", "type": "int"}, {"name": "end", "type": "int"}],
        "returns": "dict[str, object]"
      },
      "starter_code": "def prime_summary(start: int, end: int) -> dict:\n    return {\"primes\": [], \"count\": 0}\n",
      "cases": [
        {"args": [2, 10], "expected": {"primes": [2, 3, 5, 7], "count": 4}, "explanation": "包含两个边界。"},
        {"args": [14, 16], "expected": {"primes": [], "count": 0}, "explanation": "区间内没有质数。"}
      ]
    }
  ]
}
```

- [ ] **Step 4: Author the nine manifests in parallel ownership groups**

Use four stable exercises per course with the following slug/function matrix; each has two to four deterministic examples and Chinese Markdown instructions defining boundary behavior:

| Course | Slug / function |
| --- | --- |
| Foundations | `prime-range-summary/prime_summary`, `filter-and-square/filter_and_square`, `word-frequency/word_frequency`, `group-scores/group_scores` |
| Essentials | `parse-number-lines/parse_number_lines`, `normalize-user-json/normalize_user`, `summarize-csv-rows/summarize_rows`, `validate-contact-fields/validate_contacts` |
| Language/Linux | `binary-search-position/binary_search`, `merge-overlapping-ranges/merge_ranges`, `css-specificity/selector_specificity`, `unix-permission-mode/permission_mode` |
| Databases/SQL | `apply-record-mutations/apply_mutations`, `grouped-sales-query/group_sales`, `department-dense-rank/dense_rank`, `aggregate-event-log/aggregate_events` |
| Django | `dispatch-request/dispatch_request`, `parse-cookie-header/parse_cookies`, `serialize-api-records/serialize_records`, `paginate-resources/paginate_resources` |
| Scraping | `robots-path-policy/is_path_allowed`, `merge-query-params/build_url`, `normalize-extracted-records/normalize_records`, `deduplicate-crawl-queue/deduplicate_urls` |
| Data Analysis | `select-matrix-values/select_values`, `broadcast-column-offsets/add_column_offsets`, `multiply-matrices/matmul`, `fill-missing-series/fill_missing` |
| Machine Learning | `knn-classify/knn_predict`, `gini-impurity/gini_impurity`, `simple-linear-regression/linear_regression`, `nearest-centroid/assign_centroids` |
| Production | `clean-api-payload/clean_payload`, `merge-shopping-carts/merge_carts`, `weighted-round-robin/weighted_schedule`, `batch-iterable/batch_items` |

Avoid real I/O, external packages, randomness, framework imports, and output-order ambiguity. Use approximate comparison only for regression/metric exercises.

- [ ] **Step 5: Run manifest tests**

Run: `cd backend; uv run python -m unittest tests.test_practice_manifest -v`

Expected: all manifest validation and shipped-content tests PASS with exactly 36 exercises.

- [ ] **Step 6: Commit curriculum manifests**

```text
git add backend/app/practice_manifest.py backend/content/practice backend/tests/test_practice_manifest.py
git commit -m "feat: add curriculum-linked practice manifests"
```

### Task 3: Replace Destructive Course Sync With Stable Upsert

**Files:**
- Modify: `backend/app/course_sync.py`
- Modify: `backend/tests/test_course_sync.py`

**Interfaces:**
- Consumes: `load_practice_manifests` and stable exercise seeds from Task 2.
- Produces: `sync_courses(..., practice_root: Path | None = None) -> SyncResult` that preserves unchanged row IDs and progress.

- [ ] **Step 1: Replace destructive-sync assertions with preservation assertions**

Update the changed-Markdown test and add exercise-content coverage:

```python
def test_changed_markdown_updates_in_place_and_preserves_progress(self):
    user = self._add_user()
    sync_courses(self.db, self.root, self.specs, self.practice_root)
    lesson = self.db.scalar(select(Lesson).order_by(Lesson.id))
    original_id = lesson.id
    self.db.add(Progress(user_id=user.id, lesson_id=lesson.id, completed=True, score=80))
    self.db.commit()
    self._append_markdown("fixture-one", "01.第一课.md", "内容变化。")
    sync_courses(self.db, self.root, self.specs, self.practice_root)
    self.assertEqual(self.db.scalar(select(Lesson.id).where(Lesson.source_path == "Day01-20/01.第一课.md")), original_id)
    self.assertEqual(self.db.scalar(select(func.count(Progress.id))), 1)
```

Add tests proving exercise ID and `ExerciseProgress` survive prompt/case updates, quick checks receive stable slugs, removed manifest exercises alone are deleted, rollback preserves the prior graph, and lesson detail quick-check ordering stays stable.

- [ ] **Step 2: Run sync tests and verify the destructive behavior fails them**

Run: `cd backend; uv run python -m unittest tests.test_course_sync -v`

Expected: FAIL because the current mismatch path deletes every course, lesson, exercise, and progress row.

- [ ] **Step 3: Merge practice seeds into lesson records**

Extend `ExerciseSeed` with kind/title/slug/function metadata/cases/tags while preserving `_exercise(...)` as a quick-check constructor. Build stable quick-check slugs from course slug, lesson source path, and one-based position. Include practice manifest digests in `manifest_matches` so a changed prompt or case triggers an upsert.

- [ ] **Step 4: Implement transactional upsert helpers**

Use four focused helpers with exact signatures: `upsert_course(db: Session, manifest: CourseManifest) -> Course`, `upsert_lesson(db: Session, course: Course, record: LessonRecord) -> Lesson`, `upsert_exercise(db: Session, lesson: Lesson, seed: ExerciseSeed, order: int) -> Exercise`, and `replace_cases_and_tags(db: Session, exercise: Exercise, seed: ExerciseSeed) -> None`.

Load existing courses by slug, lessons by source path, and exercises by slug. For legacy lessons with empty `source_path`, allow a single `(course, order)` migration match. Flush IDs before cases/tags. Delete only stale manifest-owned exercises, lessons, and courses after upserts, relying on explicit relationship cleanup for records that truly disappeared. Keep one outer transaction and rollback on every exception.

- [ ] **Step 5: Run sync and API regression tests**

Run: `cd backend; uv run python -m unittest tests.test_course_sync tests.test_api -v`

Expected: all tests PASS; content edits preserve stable IDs and progress.

- [ ] **Step 6: Commit stable synchronization**

```text
git add backend/app/course_sync.py backend/tests/test_course_sync.py
git commit -m "fix: preserve progress during curriculum sync"
```

### Task 4: Implement Restricted Function Execution

**Files:**
- Create: `backend/app/practice_runner.py`
- Create: `backend/tests/test_practice_runner.py`
- Modify: `backend/pyproject.toml`
- Modify: `backend/uv.lock`

**Interfaces:**
- Produces: `RunnerCase`, `CaseResult`, `RunResult`, `PracticeRunner.run(code: str, function_name: str, cases: Sequence[RunnerCase]) -> RunResult`.
- Consumes: JSON-safe args/kwargs/expected values from `ExerciseCase`.

- [ ] **Step 1: Write runner result and containment tests**

Cover exact/approximate pass, wrong answer, syntax error, missing function, raised exception, timeout, oversized source, and unsupported operations:

```python
def test_runs_function_against_all_public_cases(self):
    result = self.runner.run(
        "def add(a, b):\n    return a + b\n",
        "add",
        [RunnerCase([2, 3], {}, 5), RunnerCase([-1, 1], {}, 0)],
    )
    self.assertTrue(result.passed)
    self.assertTrue(all(case.passed for case in result.cases))

def test_rejects_import_file_network_process_and_eval(self):
    for source in self.forbidden_sources:
        result = self.runner.run(source, "solve", [RunnerCase([], {}, None)])
        self.assertFalse(result.passed)
        self.assertEqual(result.error_kind, "unsupported_operation")
```

Use fixtures for `import os`, `open(...)`, `__import__(...)`, `eval(...)`, dunder traversal, `while True`, a huge allocation, and an over-12,000-character source.

- [ ] **Step 2: Run runner tests and verify failure**

Run: `cd backend; uv run python -m unittest tests.test_practice_runner -v`

Expected: FAIL because the runner module does not exist.

- [ ] **Step 3: Add and lock RestrictedPython**

Run: `cd backend; uv add "RestrictedPython>=8,<9"`

Expected: `pyproject.toml` and `uv.lock` contain a Python 3.14-compatible RestrictedPython release. If the resolver proves that major incompatible, use the newest resolver-supported release and record its exact version in the lockfile rather than weakening containment tests.

- [ ] **Step 4: Implement the child-process runner**

Compile with `compile_restricted`, expose only deterministic collection/numeric/string builtins, and evaluate cases in a spawned child. The parent owns timeout and serialized result limits:

```python
MAX_SOURCE_CHARS = 12_000
RUN_TIMEOUT_SECONDS = 2.0
MAX_RESULT_CHARS = 8_000

class PracticeRunner:
    def run(self, code: str, function_name: str, cases: Sequence[RunnerCase]) -> RunResult:
        if len(code) > MAX_SOURCE_CHARS:
            raise SourceTooLarge
        process = multiprocessing.get_context("spawn").Process(
            target=_execute_restricted,
            args=(queue, code, function_name, tuple(cases)),
        )
        process.start()
        process.join(RUN_TIMEOUT_SECONDS)
        if process.is_alive():
            process.terminate()
            process.join()
            return RunResult.timeout()
        return read_bounded_result(queue)
```

Normalize tuples to JSON arrays for comparison, compare dictionaries recursively, and apply tolerance only to numeric leaves in approximate cases. Return learner-safe messages without host paths or tracebacks.

- [ ] **Step 5: Run runner tests and the full backend suite**

Run: `cd backend; uv run python -m unittest tests.test_practice_runner -v`

Run: `cd backend; uv run python -m unittest discover -s tests -v`

Expected: all tests PASS and forbidden operations fail closed.

- [ ] **Step 6: Commit the restricted runner**

```text
git add backend/app/practice_runner.py backend/tests/test_practice_runner.py backend/pyproject.toml backend/uv.lock
git commit -m "feat: add restricted function practice runner"
```

### Task 5: Add Practice Catalog, Detail, Run, and Progress APIs

**Files:**
- Create: `backend/app/practice_service.py`
- Create: `backend/tests/test_practice_api.py`
- Modify: `backend/app/auth.py`
- Modify: `backend/app/ratelimit.py`
- Modify: `backend/app/schemas.py`
- Modify: `backend/app/main.py`
- Modify: `backend/tests/test_api.py`

**Interfaces:**
- Produces: `GET /api/practice/exercises`, `GET /api/practice/exercises/{slug}`, and authenticated `POST /api/practice/exercises/{slug}/run`.
- Produces: `optional_current_user`, `practice_limiter`, `PracticeCatalogOut`, `PracticeDetailOut`, `PracticeRunIn`, and `PracticeRunOut`.
- Consumes: models, stable sync content, and `PracticeRunner`.

- [ ] **Step 1: Write API workflow tests**

Test anonymous catalog/detail, query/course/lesson/difficulty/tag filters, curriculum ordering, page bounds, authenticated status filter, invalid filter values, 404, and absence of expected quick-check answers. Test run auth and progress:

```python
def test_run_updates_lightweight_progress_without_history(self):
    auth = self.register()
    detail = self.client.get("/api/practice/exercises/prime-range-summary").json()
    submitted_code = detail["starter_code"].replace("return {\"primes\": [], \"count\": 0}", self.correct_body)
    response = self.client.post(
        "/api/practice/exercises/prime-range-summary/run",
        headers=auth["headers"],
        json={"code": submitted_code},
    )
    self.assertEqual(response.status_code, 200, response.text)
    self.assertTrue(response.json()["passed"])
    resumed = self.client.get("/api/practice/exercises/prime-range-summary", headers=auth["headers"]).json()
    self.assertEqual(resumed["progress"]["status"], "passed")
    self.assertEqual(resumed["progress"]["attempts"], 1)
    self.assertEqual(resumed["progress"]["last_code"], submitted_code)
```

Add tests for failed run -> in-progress, passed then failed remains passed, syntax/runtime/timeout result shapes, oversized code `413`, rate limit `429`, runner unavailable `503` with unchanged attempts, and function exercises rejected by the legacy short-answer endpoint.

- [ ] **Step 2: Run API tests and verify failure**

Run: `cd backend; uv run python -m unittest tests.test_practice_api -v`

Expected: FAIL with practice endpoints not found.

- [ ] **Step 3: Add optional authentication and practice rate limiting**

Refactor token decoding into one helper used by mandatory and optional dependencies. No credentials returns `None` for optional auth; malformed or expired supplied credentials still returns `401`. Add a limiter keyed by authenticated user ID plus client IP, resettable in tests, with 20 runs per 60 seconds.

- [ ] **Step 4: Implement schemas and query service**

Define strict query enums and response models. `practice_service.list_exercises` joins Course/Lesson/Tag and optionally ExerciseProgress, applies parameterized filters, counts before pagination, and orders by a SQL `case` expression generated from `COURSE_SPECS` slug order, then `Lesson.order` and `Exercise.order`. `get_exercise_detail` loads cases/tags and overlays authenticated progress without exposing quick checks.

- [ ] **Step 5: Implement run orchestration and progress transaction**

Convert cases to `RunnerCase`, run outside an open database transaction, then create/update one `ExerciseProgress` row atomically:

```python
def record_run(db: Session, user_id: int, exercise_id: int, code: str, passed: bool) -> ExerciseProgress:
    progress = db.scalar(select(ExerciseProgress).where(
        ExerciseProgress.user_id == user_id,
        ExerciseProgress.exercise_id == exercise_id,
    ))
    if progress is None:
        progress = ExerciseProgress(user_id=user_id, exercise_id=exercise_id)
        db.add(progress)
    progress.attempts += 1
    progress.last_code = code
    progress.status = "passed" if passed or progress.status == "passed" else "in_progress"
    db.commit()
    db.refresh(progress)
    return progress
```

Update lesson summary/detail construction so `has_exercises` and `exercises` refer only to quick checks, while `practice_count` counts function exercises.

- [ ] **Step 6: Run backend API and regression suites**

Run: `cd backend; uv run python -m unittest tests.test_practice_api tests.test_api -v`

Run: `cd backend; uv run python -m unittest discover -s tests -v`

Expected: practice workflows and all legacy endpoints PASS.

- [ ] **Step 7: Commit practice APIs**

```text
git add backend/app/auth.py backend/app/ratelimit.py backend/app/schemas.py backend/app/practice_service.py backend/app/main.py backend/tests/test_practice_api.py backend/tests/test_api.py
git commit -m "feat: expose lightweight practice APIs"
```

### Task 6: Add Practice Routes and Catalog

**Files:**
- Create: `frontend/src/api.ts`
- Create: `frontend/src/practice/types.ts`
- Create: `frontend/src/practice/PracticeCatalog.tsx`
- Create: `frontend/src/practice/PracticeCatalog.test.tsx`
- Create: `frontend/src/practice/practice.css`
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/main.test.tsx`
- Modify: `frontend/src/i18n.ts`
- Modify: `frontend/src/i18n.test.ts`
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`

**Interfaces:**
- Produces: `apiRequest<T>(path, options, fallback, signal?)`, `PracticeCatalog`, URL-backed `PracticeFilters`, and practice API TypeScript types.
- Consumes: existing authentication token, locale context/copy, themes, Lucide, and FastAPI endpoints from Task 5.

- [ ] **Step 1: Install route and editor dependencies**

Run: `cd frontend; npm install react-router-dom @uiw/react-codemirror @codemirror/lang-python`

Expected: package and lock files include React Router and CodeMirror 6 packages without peer-dependency errors.

- [ ] **Step 2: Write catalog and navigation tests**

Use `MemoryRouter` and mocked fetch responses to prove:

```tsx
it('opens the independent practice catalog without loading a course or lesson', async () => {
  render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
  fireEvent.click(screen.getByTestId('nav-practice'))
  expect(await screen.findByRole('heading', { name: /练习题库/i })).toBeVisible()
  expect(fetchMock.calls.some(([url]) => String(url).includes('/practice/exercises'))).toBe(true)
  expect(fetchMock.calls.some(([url]) => /\/courses\/\d+|\/lessons\//.test(String(url)))).toBe(false)
})
```

Add catalog loading, error/retry, empty, search debounce, filters, clear, pagination, anonymous status prompt, URL restoration, stale request cancellation, and row navigation tests.

- [ ] **Step 3: Run frontend tests and verify failure**

Run: `cd frontend; npm run test -- src/practice/PracticeCatalog.test.tsx src/main.test.tsx`

Expected: FAIL because routes and catalog do not exist.

- [ ] **Step 4: Extract the shared API client**

Move the existing request helper from `main.tsx` to `api.ts`, preserve token/header/error behavior, add `AbortSignal`, and export a typed `ApiError` carrying status. Update existing callers and tests without changing course behavior.

- [ ] **Step 5: Integrate React Router and remove foundation proxy state**

Wrap the production root in `BrowserRouter`; allow tests to supply `MemoryRouter`. Derive practice active navigation from `useLocation`, navigate to `/practice`, remove `foundation`, `openFoundation`, and foundation detail prefetch, and render route elements for catalog/workspace while retaining overview/course state outside practice routes.

- [ ] **Step 6: Implement the URL-backed catalog**

Build accessible search, select/menu filters, result count, reset command, problem rows, and pagination. Use `useSearchParams` as source of truth, `AbortController` on each request, a 250 ms search debounce, and stable page reset when filters change. Use `Search`, `SlidersHorizontal`, `RotateCcw`, `CheckCircle2`, `CircleDashed`, `ChevronLeft`, and `ChevronRight` from Lucide.

- [ ] **Step 7: Add catalog localization and responsive styling**

Add complete Chinese/English keys for catalog title, search, filters, status, difficulty, result counts, empty/error/auth states, pagination, and accessibility labels. Implement a dense table on desktop and stacked rows plus filter sheet on mobile. Reuse existing mineral light and dark tokens; do not create a white page or card-within-card layout.

- [ ] **Step 8: Run catalog tests and build**

Run: `cd frontend; npm run test -- src/practice/PracticeCatalog.test.tsx src/main.test.tsx src/i18n.test.ts`

Run: `cd frontend; npm run build`

Expected: focused tests PASS and TypeScript/Vite build succeeds.

- [ ] **Step 9: Commit independent catalog**

```text
git add frontend/package.json frontend/package-lock.json frontend/src/api.ts frontend/src/main.tsx frontend/src/main.test.tsx frontend/src/i18n.ts frontend/src/i18n.test.ts frontend/src/practice
git commit -m "feat: add independent practice catalog"
```

### Task 7: Build the Split Function Exercise Workspace

**Files:**
- Create: `frontend/src/practice/PracticeWorkspace.tsx`
- Create: `frontend/src/practice/PracticeEditor.tsx`
- Create: `frontend/src/practice/PracticeWorkspace.test.tsx`
- Modify: `frontend/src/practice/practice.css`
- Modify: `frontend/src/practice/types.ts`
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/i18n.ts`

**Interfaces:**
- Produces: routed `PracticeWorkspace`, `PracticeEditor`, per-case result panel, and `onRequireAuth(pendingAction)` handoff.
- Consumes: `/api/practice/exercises/{slug}`, run endpoint, `CourseMarkdown`, current user/auth modal, theme, and router navigation.

- [ ] **Step 1: Write workspace workflow tests**

Cover detail loading/error/404/retry, saved-code resume, starter reset, related lesson navigation, auth interception retaining code, disabled duplicate run, passed/failed/runtime/timeout results, stale response protection, direct URL, back-to-filtered-catalog, mobile tabs, and theme editor extension:

```tsx
it('keeps code while authentication completes and then runs public examples', async () => {
  const user = userEvent.setup()
  renderWorkspace({ user: null })
  await user.clear(await screen.findByRole('textbox', { name: /Python code/i }))
  await user.type(screen.getByRole('textbox', { name: /Python code/i }), CORRECT_CODE)
  await user.click(screen.getByRole('button', { name: /运行样例/i }))
  expect(screen.getByRole('dialog', { name: /登录/i })).toBeVisible()
  completeLogin()
  expect(screen.getByRole('textbox', { name: /Python code/i })).toHaveValue(CORRECT_CODE)
  await user.click(screen.getByRole('button', { name: /运行样例/i }))
  expect(await screen.findByText(/全部样例通过/i)).toBeVisible()
})
```

- [ ] **Step 2: Run workspace tests and verify failure**

Run: `cd frontend; npm run test -- src/practice/PracticeWorkspace.test.tsx`

Expected: FAIL because workspace components do not exist.

- [ ] **Step 3: Implement detail state and CodeMirror editor**

Fetch by route slug with abort protection. Initialize code once per loaded exercise from `progress.last_code || starter_code`; retain the local buffer through auth state changes. Configure CodeMirror Python syntax, line numbers, bracket matching, indentation, light/dark `EditorView.theme`, and a stable minimum height. Reset requires a confirmation only when code differs from the initial value.

- [ ] **Step 4: Implement authenticated run and result states**

Run only when user exists; otherwise open auth and preserve code without auto-executing after login. Disable while running. Render each example with expected/actual values and a Lucide status icon. Keep the editor buffer on network, runner, syntax, runtime, and timeout errors. Ignore responses whose slug/request ID no longer matches.

- [ ] **Step 5: Build desktop panes and mobile tabs**

Use a full-width unframed workspace with resizable-looking but stable `minmax(0, 1fr)` panes; do not implement drag resizing in this release. Reuse sanitized Markdown for the prompt. On widths below 760 px, render `Statement`, `Code`, and `Results` tabs; running activates Results. Ensure code, JSON values, and long words scroll inside their own regions rather than widening the page.

- [ ] **Step 6: Wire auth and course relationship actions**

Pass `user` and `onAuth` from `App`. The related lesson command deliberately returns to course view and loads that exact lesson; ordinary workspace actions stay within practice routes. Preserve catalog query parameters in navigation state and restore scroll position on Back.

- [ ] **Step 7: Run workspace, catalog, and full frontend tests**

Run: `cd frontend; npm run test -- src/practice/PracticeWorkspace.test.tsx src/practice/PracticeCatalog.test.tsx src/main.test.tsx`

Run: `cd frontend; npm run test`

Run: `cd frontend; npm run build`

Expected: all frontend tests PASS and the production bundle builds.

- [ ] **Step 8: Commit the exercise workspace**

```text
git add frontend/src/practice frontend/src/main.tsx frontend/src/i18n.ts
git commit -m "feat: build function exercise workspace"
```

### Task 8: Course Integration, Documentation, and End-to-End Acceptance

**Files:**
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/main.test.tsx`
- Modify: `frontend/src/styles.css`
- Modify: `README.md`
- Modify: `backend/tests/test_api.py`
- Modify: `frontend/src/main.test.tsx`

**Interfaces:**
- Consumes: complete backend and frontend practice flows.
- Produces: related-practice links, documented operational limits, deployable packaging, and final evidence.

- [ ] **Step 1: Add course-to-practice integration tests**

Assert lesson summaries/details include `practice_count`, lessons with function exercises show a Lucide `Code2` practice command, the command navigates to `/practice?lesson_id=<id>`, and lessons without function exercises do not render a false call to action. Existing quick checks still render and submit independently.

- [ ] **Step 2: Implement the related practice entry**

Add the count-aware command near lesson navigation rather than inside the quick-check card. Preserve the course reader when no practice is available. Use existing button primitives and responsive constraints.

- [ ] **Step 3: Package and document runtime behavior**

Verify the existing `COPY content ./content` Docker instruction includes `backend/content/practice`. Document the three practice endpoints, 36-question mapping, login boundary, restricted Python subset, two-second/12,000-character limits, rate limit, no hidden tests/history, and the schema-upgrade/startup sequence. The restricted child process remains inside the API service, so Compose gains no extra service or network.

- [ ] **Step 4: Run complete automated verification**

Run: `cd backend; uv run python -m unittest discover -s tests -v`

Run: `cd frontend; npm run test`

Run: `cd frontend; npm run build`

Run: `git diff --check`

Expected: every backend and frontend test passes, build succeeds, and whitespace check is clean.

- [ ] **Step 5: Start fresh backend and frontend services**

Use a temporary SQLite database and unused local ports if 8000/5173 are occupied. Verify:

```text
GET /api/health -> 200
GET /api/practice/exercises -> total 36
GET /api/practice/exercises/prime-range-summary -> 200 with related lesson and public cases
POST /api/practice/exercises/prime-range-summary/run without token -> 401
authenticated correct run -> passed true and persisted progress
```

- [ ] **Step 6: Perform browser acceptance**

Use Playwright/Chrome at 1440x900 and 390x844 in both themes. Capture evidence for catalog filters, direct workspace URL, CodeMirror rendering, auth interception, failed examples, all-passed examples, mobile tabs, Back/query restoration, related lesson navigation, focus behavior, and zero horizontal overflow. Confirm browser console has no uncaught error and all network requests stay within practice APIs until the related lesson command is deliberately used.

- [ ] **Step 7: Review final diff and commit delivery**

Inspect `git diff --stat`, `git diff --check`, `git status -sb`, and all commits since the design baseline. Remove generated screenshots/temp databases from the worktree while preserving user files. Commit only the intended integration/docs changes:

```text
git add README.md backend/tests/test_api.py frontend/src/main.tsx frontend/src/main.test.tsx frontend/src/styles.css
git commit -m "docs: deliver curriculum practice lab"
```
