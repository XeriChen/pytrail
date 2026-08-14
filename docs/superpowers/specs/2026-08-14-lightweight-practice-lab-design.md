# Lightweight Practice Lab Design

**Status:** Approved

**Goal:** Replace the course-proxy practice tab with an independent, curriculum-linked Python function exercise library. Learners browse public exercises, open a dedicated split workspace, run public examples after signing in, and retain lightweight per-exercise progress without a full online judge or submission history.

## Product Decisions

- The practice lab is independent from the course reader. `/practice` is the catalog and `/practice/:slug` is the exercise workspace.
- Every programming exercise belongs to one exact lesson. A lesson may have zero or more programming exercises.
- The first release contains 36 curated exercises: four for each of the nine courses.
- Exercises use a LeetCode-style Python function contract. Learners implement a named function; the platform invokes it with JSON-safe arguments and compares the returned value with public expected values.
- The catalog and exercise statements are public. Running code and recording progress require authentication.
- Progress stores one current record per user and exercise: status, attempts, last code, and update time. There is no submission history, hidden test, score, ranking, contest, discussion, or multi-language support.
- Existing lesson quick checks remain available and keep their current answer-submission contract.

## Domain Model

The existing `Exercise` entity remains the owner of both quick checks and programming exercises. The two behaviors are separated by an explicit `kind` value:

- `quick_check`: the existing short-answer interaction embedded in the course reader.
- `function`: a programming exercise shown in the independent practice lab.

`Exercise` gains these fields:

| Field | Purpose |
| --- | --- |
| `slug` | Stable public identifier; unique and required for function exercises. Quick checks receive deterministic internal slugs during sync. |
| `kind` | `quick_check` or `function`. |
| `title` | Catalog and workspace title. |
| `difficulty` | `easy`, `medium`, or `hard`. |
| `function_name` | Exact function the runner calls. |
| `signature` | JSON parameter and return-type metadata used for display and validation. |
| `order` | Stable order within a lesson. |

The existing `prompt` stores Markdown for function exercises, `starter_code` stores the editable template, and `expected_answer` remains meaningful only for quick checks.

`ExerciseCase` stores ordered public examples:

- `exercise_id`
- `order`
- `args` as a JSON array
- `kwargs` as a JSON object
- `expected` as JSON
- optional `explanation`
- `comparison`, initially `exact` or `approximate`
- numeric `tolerance`, defaulting to `1e-6`

`Tag` and `exercise_tags` provide normalized many-to-many topic filtering. Tags are stable lowercase slugs with bilingual display labels supplied by frontend i18n.

`ExerciseProgress` has a unique `(user_id, exercise_id)` key and stores:

- `status`: `in_progress` or `passed`; absence means `not_started`
- `attempts`
- `last_code`
- `updated_at`

Passing is monotonic: a later failed run does not downgrade a previously passed exercise. Attempts increment only when the runner accepts and evaluates a request. Infrastructure failures do not alter progress.

## Stable Curriculum Mapping and Sync

Programming exercise manifests live in `backend/content/practice/<course-slug>.json`. Each file contains exactly four exercises and references its lesson by the discovered course source path rather than a generated database ID or array index. The synchronizer validates:

- all nine expected manifest files exist;
- every exercise slug is globally unique;
- every referenced course and lesson source path exists;
- each course has exactly four function exercises;
- titles, Markdown prompts, starter code, signatures, tags, and at least two public cases are present;
- arguments conform to the declared parameter count;
- function names and difficulty values are valid;
- case payloads are JSON-safe and bounded in size.

`Lesson` gains `source_path` so manifests can map every function exercise to an exact chapter before any database write. This release has no production users or data-retention requirement, so it deliberately uses a fresh schema rather than carrying a legacy migration layer.

Synchronization retains the existing simple rebuild model:

1. Build and validate the complete course and practice manifests in memory.
2. If the stored catalog exactly matches, perform no database writes.
3. If content differs, delete lesson progress, exercise progress, exercise associations/cases/tags, exercises, lessons, and courses in dependency order.
4. Recreate the complete validated catalog in one transaction while preserving `User` rows.
5. Roll back the whole rebuild on any failure.

Changing course Markdown or exercise manifests therefore clears learning progress and may change database IDs. Stable exercise slugs remain the public URL contract. Deployment starts from a newly created database; no compatibility code for the previous schema is retained.

## Curated Exercise Distribution

Each course receives four standard-library, deterministic function exercises. Exercises model the lesson concept without requiring files, databases, browsers, networks, framework processes, third-party data packages, or random behavior.

| Course | Selected lesson areas |
| --- | --- |
| Python Foundations | branch/loop practice, list processing, string processing, dictionary aggregation |
| Python Essentials | tolerant text parsing, JSON normalization, CSV-like row aggregation, regular-expression-style validation implemented from explicit input rules |
| Language and Linux | binary search/algorithm work, selector specificity, Unix permission conversion, one additional algorithm exercise from the advanced Python lesson |
| Databases and SQL | record mutations, query/filter/group behavior, ranking/window behavior, log aggregation |
| Django Web Development | request routing, cookie/session parsing, API serialization, filtering/sorting/pagination |
| Web Scraping | robots rule matching, URL construction, extracted-record normalization, ordered URL deduplication/batching |
| Data Analysis | matrix selection, broadcasting-style transformation, matrix multiplication, missing-value cleanup/statistics |
| Machine Learning | k-nearest-neighbor voting, impurity calculation, simple linear regression metrics, centroid assignment |
| Projects and Production | recursive API payload cleanup, cart merging, weighted scheduling, iterable batching |

Content remains Chinese in both locales, consistent with lesson Markdown. Interface chrome, filter labels, statuses, errors, difficulty names, and tag labels remain bilingual.

## API Contract

### `GET /api/practice/exercises`

Public paginated catalog endpoint. Supported query parameters:

- `query`
- `course`
- `lesson_id`
- `difficulty`
- `tag`
- `status` for authenticated users
- `page`, default `1`
- `page_size`, default `12`, maximum `48`

Default order is curriculum order: course registry order, lesson order, exercise order. The response contains `items`, `total`, `page`, `page_size`, and filter facets. Each item contains exercise identity, title, difficulty, tags, course summary, lesson summary, and optional authenticated progress. It never contains starter code, complete prompt Markdown, example expected values, or quick checks.

### `GET /api/practice/exercises/{slug}`

Public exercise detail endpoint. It returns:

- identity, title, difficulty, tags, and Markdown prompt;
- function name and structured signature;
- starter code;
- all public examples and explanations;
- exact related course and lesson metadata;
- optional authenticated progress and last code.

The last saved code replaces starter code when an authenticated learner resumes.

### `POST /api/practice/exercises/{slug}/run`

Authenticated endpoint with `{ "code": "..." }`. It validates exercise kind, code size, function definition, rate limits, and runner availability, then evaluates every public example. It returns:

- overall `passed`;
- structured result per example: `passed`, expected value, actual value, duration, and a bounded learner-safe error;
- updated progress status and attempt count.

Syntax errors, missing functions, runtime errors, timeouts, unsupported operations, and wrong return values are exercise results, not HTTP server errors. Authentication, validation, rate limiting, missing exercises, and unavailable infrastructure use appropriate `401`, `404`, `413`, `422`, `429`, or `503` responses.

The existing `POST /api/exercises/{id}/submit` remains restricted to `quick_check`. The lesson detail endpoint returns only quick checks in `exercises`; function exercises are represented by a new `practice_count` field so the reader can link to filtered practice without embedding the workspace.

## Restricted Function Runner

The existing `/api/execute` runs arbitrary Python with insufficient isolation and is not reused by the practice lab.

The practice runner accepts only function implementations and uses a proven restricted-execution compiler/runtime. It exposes a small allowlist of deterministic Python builtins and collection operations. Imports, file access, network access, process creation, dynamic code evaluation, dunder traversal, global environment access, and interactive input are unavailable.

Each request runs in a separate child process with:

- a 12,000-character source limit;
- a two-second total timeout;
- bounded serialized input and result sizes;
- captured and truncated diagnostics;
- CPU/memory/process limits where the host supports them;
- no application database session, token, secret, or request object in the child environment.

The runner API is behind an interface so tests use a deterministic fake and deployment can later replace the restricted child process with a dedicated sandbox service. Authentication plus per-user and per-IP rate limits apply before execution.

## Frontend Information Architecture

The app adds real URL navigation for the practice flow:

- `/practice`: catalog
- `/practice/:slug`: workspace

The existing overview and course reader remain behaviorally unchanged. The practice navigation item enters `/practice` directly and never loads `python-foundations` or calls a lesson endpoint.

### Catalog

The catalog is a dense, scan-oriented problem table rather than a marketing card grid. It includes:

- search input;
- course, lesson, difficulty, tag, and progress filters;
- result count and clear-filter action;
- status, title, corresponding lesson, difficulty, and tags per row;
- URL-backed filter state and pagination;
- independent loading, empty, error, retry, and unauthenticated-status states.

On narrow screens, filters open in a modal sheet and rows become stable stacked records. Text, status, and controls must not overflow horizontally.

### Exercise Workspace

Desktop uses the approved split layout:

- left pane: title, metadata, sanitized Markdown prompt, function contract, public examples, and a deliberate related-lesson link;
- right pane: Python code editor, reset action, run action, and example result panel.

The editor uses CodeMirror with Python syntax, line numbers, bracket matching, indentation, light/dark themes, and accessible labels. All command buttons use Lucide icons and text where the command is not universally understood.

Mobile uses `Statement`, `Code`, and `Results` tabs rather than compressed side-by-side panes. Running switches to Results. Browser back returns to the catalog with filters and scroll position preserved. Refresh and direct URLs restore the same exercise.

The workspace handles unauthenticated run attempts by opening the existing authentication modal and retaining unsent code. It handles loading, missing exercise, runner error, timeout, individual case failure, all-passed, stale response, and retry states without losing the editor buffer.

## State and Data Flow

1. Entering `/practice` loads catalog data from practice APIs only.
2. Filters update URL search parameters and trigger a request guarded by an abort signal/request identity.
3. Selecting an exercise navigates to its stable slug and fetches detail independently.
4. The editor initializes from saved progress code when authenticated, otherwise from starter code.
5. Run requires authentication. The UI disables duplicate runs and posts the current code.
6. The backend evaluates public cases and atomically updates the one progress row.
7. The frontend renders per-case results, updates catalog/detail progress caches, and refreshes dashboard-derived practice metrics if present.

Course reading progress and exercise practice progress remain independent. A failed programming run cannot lower a lesson score or mark a completed lesson incomplete.

## Error Handling and Security

- Invalid manifests fail startup before any sync write.
- Database sync and progress updates are transactional.
- Public APIs never expose quick-check expected answers, runner internals, tracebacks, secrets, or unrestricted source execution.
- Markdown uses the existing sanitized renderer.
- Filter values are validated enums/IDs and queries are parameterized through SQLAlchemy.
- Code execution is authenticated, rate-limited, size-limited, time-limited, and restricted to the function runtime.
- Progress update is server-derived from actual public-case results; clients cannot post a passed status directly.
- A passed status is monotonic during the lifetime of the current content manifest. A deliberate content rebuild clears it with the rest of learning progress.

## Testing and Acceptance

Backend tests must prove:

- all nine manifests load exactly 36 function exercises with four per course and valid lesson mappings;
- quick-check API behavior remains compatible and excludes function exercises;
- an unchanged sync is idempotent, while a Markdown or exercise change atomically rebuilds catalog data, clears both progress tables, and preserves users;
- list search, filters, status filtering, curriculum ordering, pagination, anonymous responses, and optional authenticated status work;
- detail exposes only public fields and resumes saved code;
- run requires authentication, increments attempts, stores last code, marks all-public-cases success, records in-progress failure, and never downgrades passed status;
- syntax, missing function, runtime error, timeout, oversized code, unsupported import/file/network/eval access, rate limit, 404, and runner-unavailable paths are bounded and deterministic;
- existing auth, dashboard, course, asset, quick-check, progress, and execute tests still pass.

Frontend tests must prove:

- practice navigation does not request foundation course detail or any lesson;
- catalog loading, empty, error/retry, search, filters, pagination, status, and URL restoration work;
- exercise navigation, direct URL, back behavior, saved code, reset, authentication interception, run loading, per-case failures, all-passed, timeout, and retry work;
- course reader still renders quick checks and exposes a related-practice link without embedding function exercises;
- desktop panes and mobile tabs preserve code and do not cause horizontal overflow;
- all new icons come from Lucide, both themes remain readable, and reduced-motion behavior is preserved.

Verification commands:

```text
cd backend && uv run python -m unittest discover -s tests -v
cd frontend && npm run test
cd frontend && npm run build
git diff --check
```

Manual browser acceptance covers light and dark themes at 1440x900 and 390x844: catalog filters, deep-linked workspace, editor interaction, authentication prompt, failed examples, passed examples, mobile tabs, back navigation, reload restoration, related lesson link, focus return, and absence of horizontal overflow.

## Non-Goals

- Hidden tests or authoritative competitive judging
- Submission history
- Rankings, contests, discussions, editorial solutions, or plagiarism detection
- Multiple programming languages
- Arbitrary package installation, network calls, file access, database access, or framework execution
- Replacing lesson quick checks
- Automatically generating exercises from Markdown at runtime

## File Boundaries

- `backend/app/models.py`: extended exercise fields, cases, tags, progress, and stable lesson source key.
- `backend/app/schemas.py`: practice summaries, details, filters, run results, and progress responses.
- `backend/app/course_sync.py`: manifest loading/validation and transactional full catalog rebuild.
- `backend/app/practice.py`: catalog/detail queries and progress orchestration.
- `backend/app/practice_runner.py`: restricted function compilation and child-process execution.
- `backend/app/main.py`: practice endpoints and dependency wiring.
- `backend/content/practice/*.json`: nine curated exercise manifests.
- `backend/tests/`: manifest, transactional rebuild, API, progress, and runner coverage.
- `frontend/src/practice/`: catalog, filters, workspace, editor, result panel, types, and API state.
- `frontend/src/main.tsx`: navigation integration, authentication handoff, and related-practice links.
- `frontend/src/i18n.ts`: bilingual practice chrome, tags, statuses, and errors.
- `frontend/src/styles.css`: catalog/workspace layout, themes, responsive tabs, and states.
- `frontend/src/main.test.tsx` and practice-focused tests: routing and complete learner workflow.
- `README.md`, `docker-compose.yml`, and backend packaging: operational limits and development instructions.
