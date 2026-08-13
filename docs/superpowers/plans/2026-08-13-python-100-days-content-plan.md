# Python 100 Days Content Import and Reading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import the 102 selected Python-100-Days lessons as nine stable courses and deliver safe, on-demand Markdown reading with local assets and the first 20 exercises.

**Architecture:** A dedicated backend content synchronizer owns the nine-course registry, source validation, deterministic manifest, exercise mapping, and transactional rebuild. FastAPI exposes summary, detail, lesson, and constrained asset endpoints; the frontend loads summaries, course directories, and lesson bodies in sequence and renders them through a reusable sanitized Markdown component.

**Tech Stack:** FastAPI, SQLAlchemy 2, Pydantic 2, Python 3.14, SQLite/PostgreSQL, React 19, TypeScript 7, Vite 8, React Markdown, remark-gfm, rehype-raw, rehype-sanitize, Vitest.

## Global Constraints

- Import only `Day01-20`, `Day21-30`, `Day31-35`, `Day36-45`, `Day46-60`, `Day61-65`, `Day66-80`, `Day81-90`, and `Day91-100`.
- Exclude root documents, `番外篇`, `公开课`, source `code` examples, and `code/res/` assets.
- The catalog must contain exactly 9 courses and 102 lessons; preserve merged numbers and duplicate numbers; `100.补充内容.md` is last.
- Store original UTF-8 Markdown in `lessons.markdown`; copy root-level Day `res/` trees to disk and never store image bytes in the database.
- `COURSE_CONTENT_ROOT` overrides the default content path; missing course/res directories or invalid UTF-8 Markdown fail startup with the course and path in the error.
- Synchronization is idempotent when persisted course/lesson/exercise content matches; a mismatch rebuilds all course rows in one transaction, clears `Progress`, and preserves `User` rows.
- Duration is `min(90, max(5, ceil(non_whitespace_character_count / 500)))`.
- Day01–20 retain the current exercise definitions; Day21–100 have no exercises.
- Course lists never return Markdown; course detail returns lesson summaries; lesson detail returns Markdown and link mappings.
- Asset paths are confined to the selected course's `res/` directory and all invalid/missing paths return 404.
- Original Chinese lesson Markdown and prompts remain unchanged when the UI locale switches to English.
- Existing authentication, progress, exercise submission, and authenticated code-runner behavior remains intact.

---

### Task 1: Stage Publishable Content and Define the Course Manifest

**Files:**
- Create: `backend/content/python-100-days/python-foundations/` through `projects-and-production/` with the selected Markdown files and each Day directory's root `res/` tree.
- Create: `backend/app/course_sync.py`
- Create: `backend/tests/test_course_sync.py`
- Modify: `.gitignore` only if a rule would accidentally exclude `backend/content/python-100-days/`.

**Interfaces:**
- Produces `CourseSpec`, `ExerciseSeed`, `LessonRecord`, `CourseManifest`, `COURSE_SPECS`, `resolve_content_root()`, and `build_manifests(content_root, specs=COURSE_SPECS)` for later tasks.
- `build_manifests(...) -> tuple[CourseManifest, ...]` validates all nine course directories, reads Markdown as UTF-8, sorts by `(leading_number, filename)`, computes duration, and records resource digests.

- [ ] **Step 1: Stage only the nine source roots and their root-level assets**

```powershell
$sourceRoot = (Resolve-Path 'Python-100-Days-master').Path
$targetRoot = (Resolve-Path '.').Path + '\backend\content\python-100-days'
$maps = @(
  @{ Source = 'Day01-20'; Slug = 'python-foundations' },
  @{ Source = 'Day21-30'; Slug = 'python-essentials' },
  @{ Source = 'Day31-35'; Slug = 'python-language-and-linux' },
  @{ Source = 'Day36-45'; Slug = 'databases-and-sql' },
  @{ Source = 'Day46-60'; Slug = 'web-development-with-django' },
  @{ Source = 'Day61-65'; Slug = 'web-scraping' },
  @{ Source = 'Day66-80'; Slug = 'data-analysis' },
  @{ Source = 'Day81-90'; Slug = 'machine-learning' },
  @{ Source = 'Day91-100'; Slug = 'projects-and-production' }
)
foreach ($map in $maps) {
  $source = Join-Path $sourceRoot $map.Source
  $target = Join-Path $targetRoot $map.Slug
  New-Item -ItemType Directory -Force $target | Out-Null
  Copy-Item (Join-Path $source '*.md') $target -Force
  Copy-Item (Join-Path $source 'res') (Join-Path $target 'res') -Recurse -Force
}
```

- [ ] **Step 2: Define immutable course and exercise metadata**

Use frozen dataclasses. `CourseSpec` contains `slug`, `source_dir`, `title`, `description`, `level`, `accent`, and `order`; `ExerciseSeed` contains `prompt`, `starter_code`, and `expected_answer`. Move the exact existing Day01–20 exercise values from `CURRICULUM` into a 20-entry `FOUNDATION_EXERCISES` tuple keyed by source lesson order. Define the nine specs in the approved registry order, with `python-foundations` first.

- [ ] **Step 3: Implement deterministic discovery and duration**

```python
NUMBER_RE = re.compile(r"^(\d+)(?:[-.]|$)")

def lesson_sort_key(path: Path) -> tuple[int, str]:
    match = NUMBER_RE.match(path.name)
    if not match:
        raise ContentSyncError(f"Lesson filename has no leading number: {path}")
    return int(match.group(1)), path.name.casefold()

def reading_duration(markdown: str) -> int:
    characters = len("".join(markdown.split()))
    return min(90, max(5, math.ceil(characters / 500)))
```

Read only `course_dir.glob('*.md')`, reject an empty set, strip the final `.md` and leading numeric token from each title, and preserve duplicate numeric prefixes after filename tie-breaking. Hash every Markdown byte and every file below `course_dir / 'res'` with SHA-256; missing `res` is an error.

- [ ] **Step 4: Add manifest invariant tests**

In `test_course_sync.py`, call `build_manifests` against the staged content and assert nine specs, 102 total lessons, 20/10/3/10/15/9/15/10/10 per course, final title `补充内容`, and all four 62/63-prefixed lessons. Assert every duration is between 5 and 90, Markdown contains the original Chinese heading, and `code/` files are absent from the staged tree.

- [ ] **Step 5: Run the focused test and commit**

Run: `cd backend; uv run python -m unittest tests.test_course_sync -v`

Expected: PASS for the manifest count, ordering, UTF-8, duration, and resource digest assertions.

```bash
git add backend/content/python-100-days backend/app/course_sync.py backend/tests/test_course_sync.py .gitignore
git commit -m "feat: stage Python 100 Days course content"
```

### Task 2: Implement Idempotent Transactional Synchronization

**Files:**
- Modify: `backend/app/course_sync.py`
- Modify: `backend/app/models.py`
- Modify: `backend/tests/test_course_sync.py`

**Interfaces:**
- Consumes `CourseSpec`, `LessonRecord`, and `CourseManifest` from Task 1.
- Produces `ContentIndex`, `SyncResult`, `sync_courses(db, content_root=None)`, and `content_index_from_db(db, manifests)` for the lifespan and API tasks.
- `ContentIndex.lesson_links(lesson_id) -> dict[str, int]`; `ContentIndex.lesson_source(lesson_id) -> str`; `ContentIndex.asset_root(slug) -> Path`.

- [ ] **Step 1: Write failing sync lifecycle tests**

Add tests that use a temporary SQLite database and a two-spec fixture registry. Assert first sync inserts courses/lessons/exercises while an existing `User` survives; insert a `Progress` row and assert a second identical sync preserves IDs and that row; change one Markdown byte and assert IDs are rebuilt and progress is empty. Add a test that writes invalid UTF-8 or removes a course/res directory and asserts `ContentSyncError` before any database rows change.

- [ ] **Step 2: Add the progress uniqueness contract**

Add `UniqueConstraint("user_id", "lesson_id", name="uq_progress_user_lesson")` to `Progress.__table_args__`. Keep `User` relationships and the existing SQLite/PostgreSQL-compatible column types unchanged. The synchronizer must delete `Progress` rows explicitly before deleting courses because the current `Lesson` model has no reverse progress cascade.

- [ ] **Step 3: Compare persisted content without adding a version column**

Implement `manifest_matches(db, manifests)` by comparing course slug/order/title/description/level/accent, lesson count/order/title/duration, SHA-256 of persisted Markdown, and exercise prompt/starter/expected-answer values. Treat a course set mismatch or any lesson/exercise mismatch as stale. Resource digests validate the on-disk package during manifest construction; they do not force a database rebuild by themselves because assets are not persisted in the database.

- [ ] **Step 4: Implement one-transaction rebuild and index creation**

```python
def sync_courses(db: Session, content_root: Path | None = None) -> SyncResult:
    root = content_root or resolve_content_root()
    manifests = build_manifests(root)
    if manifest_matches(db, manifests):
        return SyncResult(changed=False, index=content_index_from_db(db, manifests))
    db.execute(delete(Progress))
    db.execute(delete(Exercise))
    db.execute(delete(Lesson))
    db.execute(delete(Course))
    db.flush()
    for manifest in manifests:
        course = Course(
            title=manifest.spec.title,
            slug=manifest.spec.slug,
            description=manifest.spec.description,
            level=manifest.spec.level,
            accent=manifest.spec.accent,
        )
        for lesson_record in manifest.lessons:
            lesson = Lesson(
                course=course,
                title=lesson_record.title,
                order=lesson_record.order,
                duration=lesson_record.duration,
                markdown=lesson_record.markdown,
            )
            lesson.exercises = [
                Exercise(
                    lesson=lesson,
                    prompt=seed.prompt,
                    starter_code=seed.starter_code,
                    expected_answer=seed.expected_answer,
                )
                for seed in lesson_record.exercises
            ]
        db.add(course)
    db.commit()
    return SyncResult(changed=True, index=content_index_from_db(db, manifests))
```

Use `try/except` to `rollback()` and re-raise on database errors. Build `ContentIndex` from course slug plus lesson order/source path, and resolve Markdown links with `urljoin` against the source lesson path; map only targets that match one of the 102 lesson source paths. Do not commit until all manifests have been validated and all rows have been added.

- [ ] **Step 5: Run focused lifecycle tests and commit**

Run: `cd backend; uv run python -m unittest tests.test_course_sync -v`

Expected: PASS for user preservation, ID/progress idempotence, rebuild reset, rollback, duplicate numbering, and link-index assertions.

```bash
git add backend/app/course_sync.py backend/app/models.py backend/tests/test_course_sync.py
git commit -m "feat: sync course content transactionally"
```

### Task 3: Replace Seed APIs and Add Safe Lesson Assets

**Files:**
- Modify: `backend/app/schemas.py`
- Modify: `backend/app/main.py`
- Modify: `backend/tests/test_api.py`

**Interfaces:**
- Consumes `sync_courses`, `SyncResult.index`, and `ContentIndex` from Task 2.
- Produces `CourseSummaryOut`, `CourseDetailOut`, `LessonSummaryOut`, `LessonDetailOut`, and the routes `GET /api/courses`, `GET /api/courses/{course_id}`, `GET /api/lessons/{lesson_id}`, `GET /api/course-assets/{course_slug}/{asset_path:path}`.

- [ ] **Step 1: Write failing HTTP contract tests**

Extend `test_api.py` to assert `/api/courses` returns exactly nine summaries with `lesson_count` and `total_duration` and no `markdown`; course detail returns summaries with `has_exercises` and no `markdown`; lesson detail returns full Markdown, `course_id`, `course_slug`, `asset_base_url`, 20 Day01 exercise mappings, and a link map. Assert unknown course/lesson IDs return 404, dashboard total is 102, and Day21 detail has `exercises == []`.

- [ ] **Step 2: Add Pydantic response models**

Define `LessonSummaryOut(id, title, order, duration, has_exercises)`, `CourseSummaryOut(id, slug, title, description, level, accent, lesson_count, total_duration)`, `CourseDetailOut` with `lessons: list[LessonSummaryOut]`, and `LessonDetailOut(id, course_id, course_slug, title, order, duration, markdown, exercises, asset_base_url, lesson_links)`. Keep `ExerciseOut` unchanged so the runner and submission payloads remain compatible.

- [ ] **Step 3: Replace startup seed with lifespan synchronization**

Remove the old hard-coded seed call and `CURRICULUM` data from the request path. In the existing `lifespan`, call `sync_courses(db, resolve_content_root())`, store its returned index on `app.state.content_index`, and close the session in `finally`. Startup errors must propagate so an incomplete course never starts serving traffic.

- [ ] **Step 4: Implement summary/detail queries and asset serving**

Query courses with `selectinload(Course.lessons).selectinload(Lesson.exercises)`, construct summaries without Markdown, and sort by registry/course order then lesson order. The lesson endpoint looks up the ORM row, obtains its index links, and emits `/api/course-assets/{slug}/` as `asset_base_url`. The asset route uses `Path(unquote(asset_path))`, rejects empty/absolute paths, `..` components, NUL bytes, and non-files, then checks `candidate.resolve().is_relative_to(asset_root.resolve())` before returning `FileResponse(candidate, media_type=mimetypes.guess_type(candidate.name)[0] or 'application/octet-stream')`.

- [ ] **Step 5: Run API tests and commit**

Run: `cd backend; uv run python -m unittest tests.test_api -v`

Expected: PASS for catalog/detail separation, lesson payloads, asset MIME types, traversal/404 behavior, dashboard count, and all pre-existing auth/execute tests.

```bash
git add backend/app/schemas.py backend/app/main.py backend/tests/test_api.py
git commit -m "feat: expose on-demand course reading APIs"
```

### Task 4: Add the Sanitized Markdown Renderer

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Create: `frontend/src/markdown.tsx`
- Create: `frontend/src/markdown.test.tsx`

**Interfaces:**
- Produces `CourseMarkdown({ markdown, assetBaseUrl, lessonLinks, onLessonLink })` and pure helpers `resolveAssetUrl(url, assetBaseUrl)` and `isExternalUrl(url)` for Task 5.

- [ ] **Step 1: Install the renderer and test dependencies**

Run from `frontend`:

```bash
npm install remark-gfm rehype-raw rehype-sanitize
npm install --save-dev @testing-library/react @testing-library/jest-dom jsdom
```

Keep the existing React Markdown version and commit the lockfile changes. Set Vitest's environment to `jsdom`, include both `src/**/*.test.ts` and `src/**/*.test.tsx`, and update `tsconfig.app.json` to exclude both test extensions. Component tests use the configured DOM environment.

- [ ] **Step 2: Write failing renderer tests**

Use Testing Library to render:

```tsx
const html = renderMarkdown('| a | b |\n| - | - |\n| 1 | 2 |\n\n<img src="res/a.png" onerror="alert(1)" style="color:red">\n<script>alert(1)</script>')
expect(html).toContain('<table')
expect(html).toContain('/api/course-assets/python-foundations/res/a.png')
expect(html).not.toContain('<script')
expect(html).not.toContain('onerror')
expect(html).not.toContain('style=')
```

Add cases for `javascript:` links, iframe/form tags, external links, and an internal lesson link present in `lessonLinks`.

- [ ] **Step 3: Implement the component and URL policy**

Configure `remarkGfm`, `rehypeRaw`, and `rehypeSanitize` with a schema that permits headings, paragraphs, emphasis, lists, blockquotes, `pre/code`, tables, `details/summary`, and `a/img` `href/src/alt/title` attributes only. Do not permit `style`, event attributes, form/iframe/script tags, or unsafe protocols. Resolve `./res/x.png` and `res/x.png` against `assetBaseUrl`; allow only `http:`, `https:`, and `mailto:` external links. Wrap tables in `.markdown-table-wrap`, constrain images with `.markdown img`, and call `onLessonLink(targetId)` after `preventDefault()` for mapped lesson links.

- [ ] **Step 4: Run renderer tests and commit**

Run: `cd frontend; npm run test -- src/markdown.test.tsx`

Expected: PASS for GFM tables, safe raw HTML, local asset URLs, internal link callbacks, external link attributes, and removal of dangerous markup.

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/markdown.tsx frontend/src/markdown.test.tsx frontend/vitest.config.ts
git commit -m "feat: add sanitized course markdown renderer"
```

### Task 5: Implement On-Demand Course and Lesson Reading State

**Files:**
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/i18n.ts`
- Create or modify: `frontend/src/main.test.tsx`

**Interfaces:**
- Consumes `CourseMarkdown` from Task 4 and the four backend response shapes from Task 3.
- Produces app state transitions `CourseSummary[] -> CourseDetail -> LessonDetail`, `loadCourse(courseId)`, `loadLesson(lessonId)`, and internal lesson navigation callbacks.

- [ ] **Step 1: Define frontend API types and failing workflow tests**

Replace the existing `Lesson`/`Course` types with:

```ts
type CourseSummary = { id: number; slug: string; title: string; description: string; level: string; accent: string; lesson_count: number; total_duration: number }
type LessonSummary = { id: number; title: string; order: number; duration: number; has_exercises: boolean }
type CourseDetail = CourseSummary & { lessons: LessonSummary[] }
type LessonDetail = LessonSummary & { course_id: number; course_slug: string; markdown: string; exercises: Exercise[]; asset_base_url: string; lesson_links: Record<string, number> }
```

Mock `fetch` in `main.test.tsx` and assert that the home screen renders nine cards, clicking a card fetches `/courses/{id}`, clicking a lesson fetches `/lessons/{id}`, Day01 shows a quick check, Day21 shows the no-exercise state, and a failed lesson request exposes retry that issues the request again.

- [ ] **Step 2: Replace eager fallback state with explicit load states**

Keep `courses`, `selectedCourse`, and `selectedLesson` separate. Track `idle/loading/success/error/empty` for catalog, course detail, and lesson detail. Remove `FALLBACK_COURSE` and the default 20-lesson dashboard total. On initial load, request `/courses`; on Learn/card selection request course detail and automatically request its first lesson; ignore stale responses by comparing the requested ID before setting state.

- [ ] **Step 3: Build catalog, course directory, and reader interactions**

Render all nine summary cards on Overview with a Learn button that calls `loadCourse`. Course view has a back-to-catalog action, a course selector, lesson summary navigation, current lesson title/duration, previous/next buttons, and separate loading/error/retry/empty surfaces. `loadLesson` requests only the selected lesson body. Internal Markdown links call `loadLesson(mappedId)` and switch to the course tab; external links use the renderer's new-tab behavior.

- [ ] **Step 4: Preserve exercises, runner, auth, and progress flows**

Pass `lessonDetail.exercises` to the existing `ExerciseCard` only when non-empty; render `tx('exercise.none')` for Day21–100. Keep the code runner mounted for reading lessons, send progress with the selected lesson ID, leave `/api/execute` authorization unchanged, and keep the practice tab anchored to the `python-foundations` course after its detail is loaded.

- [ ] **Step 5: Localize only application chrome and run workflow tests**

Add Chinese/English keys for the nine course cards, course switching, chapters, back, loading, empty, failure, retry, previous/next, and no-exercise states. Remove the old hard-coded 20-lesson Markdown/title overrides from `localizeCourse`; imported lesson titles and Markdown must remain Chinese in both locales. Run `cd frontend; npm run test -- src/main.test.tsx` and commit.

```bash
git add frontend/src/main.tsx frontend/src/i18n.ts frontend/src/main.test.tsx
git commit -m "feat: load courses and lessons on demand"
```

### Task 6: Style the Catalog and Reading States Responsively

**Files:**
- Modify: `frontend/src/styles.css`
- Modify: `frontend/src/main.tsx` only for semantic wrapper/class names required by styles.

**Interfaces:**
- Consumes the DOM states and class names produced by Task 5.
- Produces responsive visual behavior for nine cards, chapter navigation, Markdown tables/images, and all loading/error/empty states.

- [ ] **Step 1: Add failing style/markup assertions**

Extend `main.test.tsx` to assert the catalog uses a stable course-card grid, the reader exposes `.markdown-table-wrap`, and error states include a retry button with an accessible label. Assert no course card renders Markdown before a lesson request succeeds.

- [ ] **Step 2: Implement desktop and mobile layout rules**

Add a multi-column `.course-catalog` that collapses to one column below 700px; keep card heights stable with `min-height` and `aspect-ratio` where visual previews are used. Make the reader sidebar horizontally scrollable on small screens, keep content width bounded, set `.markdown img { max-width: 100%; height: auto; }`, and set `.markdown-table-wrap { overflow-x: auto; }`. Add visible focus styles for course, lesson, back, retry, and navigation buttons without changing the existing palette.

- [ ] **Step 3: Style independent loading/failure/empty surfaces**

Use shared `.state-panel`, `.state-panel.error`, and `.state-panel.empty` classes with fixed padding so content does not shift while requests resolve. Keep retry as an icon-plus-text command, and ensure the longest translated label fits at 320px width without overlap.

- [ ] **Step 4: Run frontend tests/build and commit**

Run: `cd frontend; npm run test; npm run build`

Expected: PASS and a successful TypeScript/Vite build with no layout-specific type errors.

```bash
git add frontend/src/styles.css frontend/src/main.tsx frontend/src/main.test.tsx
git commit -m "style: support course catalog and responsive reader"
```

### Task 7: Package Assets, Document Runtime Configuration, and Verify End to End

**Files:**
- Modify: `backend/Dockerfile`
- Modify: `docker-compose.yml`
- Modify: `README.md`
- Modify: `.github/workflows/ci.yml` only if the new test/build commands are not already covered.
- Modify: `backend/tests/test_api.py` and `frontend/src/main.test.tsx` for final regression cases.

**Interfaces:**
- Consumes the completed backend and frontend behavior from Tasks 1–6.
- Produces a Docker image that contains `backend/content/python-100-days`, documented `COURSE_CONTENT_ROOT`, and CI coverage for backend unit tests, frontend Vitest, and the production build.

- [ ] **Step 1: Add content to the backend image and local compose path**

After `COPY app ./app` in `backend/Dockerfile`, add `COPY content ./content`. Keep `COURSE_CONTENT_ROOT` unset by default so the package-relative content path is used; document the environment override in compose/README for mounted content deployments.

- [ ] **Step 2: Update project documentation**

Document the nine-course/102-lesson import, the selected source exclusions, `COURSE_CONTENT_ROOT`, the new four read-only endpoints, local asset behavior, and the first-start synchronization/reset semantics. Update the repository tree to include `backend/content/python-100-days` and note that only Markdown enters the database.

- [ ] **Step 3: Add final regression checks**

Assert `/api/courses` has nine entries and no `markdown`, `/api/dashboard` reports `lessons_total == 102`, a representative PNG returns `image/png`, `/api/course-assets/python-foundations/../learning.db` returns 404, and a user registered before a forced sync still exists. In the frontend workflow test, assert switching from desktop-width catalog to a narrow viewport keeps the chapter list usable and images do not exceed the reading column.

- [ ] **Step 4: Run all automated checks**

```bash
cd backend
uv run python -m compileall app
uv run python -m unittest discover -s tests -v
cd ../frontend
npm run test
npm run build
```

Expected: all backend tests, Markdown/workflow tests, and TypeScript/Vite build pass.

- [ ] **Step 5: Run the app and perform browser verification**

Start the API with `cd backend; uv run uvicorn app.main:app --reload --port 8000` and the web app with `cd frontend; npm run dev -- --host 0.0.0.0`. Check desktop and mobile widths for home catalog, course directory, first lesson, 102-lesson navigation, GFM table overflow, local image loading, cross-course links, retry/error states, Day01 exercise, and Day21 no-exercise state. Stop both processes after verification and record any residual limitation in the final handoff.

- [ ] **Step 6: Commit packaging and verification documentation**

```bash
git add backend/Dockerfile docker-compose.yml README.md .github/workflows/ci.yml backend/tests frontend/src
git commit -m "docs: package and verify Python 100 Days reader"
```
