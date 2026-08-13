# Python 100 Days Content Import and Reading Design

**Status:** Approved

**Goal:** Import the 102 selected Python-100-Days Markdown lessons as nine stable courses, expose lightweight catalog and on-demand reading APIs, and provide a safe, responsive Markdown reading experience with local images and the first 20 exercises.

## Scope and Constraints

- Import only the nine main Day directories: `Day01-20`, `Day21-30`, `Day31-35`, `Day36-45`, `Day46-60`, `Day61-65`, `Day66-80`, `Day81-90`, and `Day91-100`.
- Exclude root documents, `番外篇`, `公开课`, source `code` examples, and any other non-Markdown material from the database.
- The resulting catalog must contain exactly 9 courses and 102 lessons.
- Natural ordering uses the leading numeric value in each filename. Preserve merged numbers and duplicate numbers; use the original filename as a deterministic tie-breaker. Therefore `100.补充内容.md` follows lesson 99, and all 62/63 duplicate-number files remain present.
- Store original UTF-8 Markdown in `lessons.markdown`; store images and other referenced local assets on disk under the course content root.
- Do not add database columns or introduce a migration framework. Continue to support SQLite and PostgreSQL through the existing SQLAlchemy models.
- Synchronization may reset all course progress when the content manifest changes, but must preserve every `User` row.
- Existing authentication, progress authorization, answer submission, and authenticated code execution behavior remain intact.

## Course Registry

`backend/app/course_sync.py` owns the stable registry. The registry order, slugs, source directories, and presentation metadata are:

| Order | Slug | Source | Title | Level | Accent |
| ---: | --- | --- | --- | --- | --- |
| 1 | `python-foundations` | `Day01-20` | Python 基础 / Python Foundations | beginner | cinnabar |
| 2 | `python-essentials` | `Day21-30` | Python 实用工具 / Python Essentials | beginner | jade |
| 3 | `python-language-and-linux` | `Day31-35` | 语言进阶与 Linux / Language and Linux | intermediate | gold |
| 4 | `databases-and-sql` | `Day36-45` | 数据库与 SQL / Databases and SQL | intermediate | cyan |
| 5 | `web-development-with-django` | `Day46-60` | Django Web 开发 / Web Development with Django | intermediate | cinnabar |
| 6 | `web-scraping` | `Day61-65` | 网络数据采集 / Web Scraping | intermediate | jade |
| 7 | `data-analysis` | `Day66-80` | 数据分析 / Data Analysis | intermediate | gold |
| 8 | `machine-learning` | `Day81-90` | 机器学习 / Machine Learning | advanced | cyan |
| 9 | `projects-and-production` | `Day91-100` | 项目与生产实践 / Projects and Production | advanced | cinnabar |

The frontend locale catalog supplies the bilingual title, description, level, and navigation copy. Lesson Markdown and exercise prompts remain the original Chinese source in both locales.

## Content Layout and Manifest

The checked-in publishable content layout is:

```text
backend/content/python-100-days/
  python-foundations/
    01.初识Python.md ...
    res/...
  ...
```

Each course directory contains the selected source Markdown files at its root and a copy of that source Day directory's root-level `res/` tree. `code/`, `code/res/`, root-level `res/`, `番外篇`, and `公开课` are excluded. `COURSE_CONTENT_ROOT` overrides the default absolute path resolved from the backend package; the override is used both by synchronization and the asset endpoint.

The synchronizer builds an in-memory manifest containing, for every course and lesson, the source-relative Markdown path, byte/content digest, title, numeric order, duration, and exercise mapping, plus a digest of every file under the copied root-level `res/` tree. The manifest is compared against the current database content and course shape. A matching manifest causes no database writes or ID churn. A mismatch causes one transaction that deletes all `Progress` rows, deletes and recreates `Course` rows (cascading their lessons and exercises), and commits only after every source file has been decoded and validated.

Missing course directories, missing root-level `res/` directories, unreadable files, invalid UTF-8 Markdown, or duplicate manifest identities are startup errors with the course and path in the message. A broken optional image reference is left as source Markdown and results in the normal 404 asset response; it must not create a partial database import. The transaction must roll back on any database error, leaving the previous complete dataset intact.

Reading duration is computed as `ceil(non_whitespace_character_count / 500)`, then clamped inclusively to 5 through 90 minutes. The count uses the original Markdown after removing whitespace only; code, tables, and source-language text all contribute.

Day01–20 exercises are the existing `CURRICULUM` exercise definitions mapped by lesson source order/title. Day21–100 lessons have no exercises.

## Backend API

### `GET /api/courses`

Returns `list[CourseSummary]` with only:

```json
{
  "id": 1,
  "slug": "python-foundations",
  "title": "Python 基础",
  "description": "...",
  "level": "beginner",
  "accent": "cinnabar",
  "lesson_count": 20,
  "total_duration": 0
}
```

`total_duration` is the computed sum for the course; `0` in the example only indicates the field's numeric shape. No Markdown or exercise bodies are included.

### `GET /api/courses/{id}`

Returns the course summary plus `lessons: LessonSummary[]`. Each lesson summary contains `id`, `title`, `order`, `duration`, and `has_exercises`; it does not contain Markdown.

### `GET /api/lessons/{id}`

Returns:

```json
{
  "id": 1,
  "course_id": 1,
  "course_slug": "python-foundations",
  "title": "初识Python",
  "order": 1,
  "duration": 12,
  "markdown": "# ...",
  "exercises": [{"id": 1, "prompt": "...", "starter_code": "..."}],
  "asset_base_url": "/api/course-assets/python-foundations/",
  "lesson_links": {"../Day91-100/98.项目部署上线和性能调优.md": 101}
}
```

`lesson_links` maps resolvable relative Markdown links to lesson IDs. Unknown or non-lesson links remain external/plain links and are handled by the frontend.

### `GET /api/course-assets/{course_slug}/{path}`

Serves a read-only file from that course's `res/` directory. URL-decoded paths must be relative, must not contain `..`, and must resolve to a regular file below the selected course root. Unknown slugs, directories, missing files, malformed paths, and traversal attempts return 404. The response uses the file's MIME type and does not expose files outside `res/`.

### Dashboard

`lessons_total` counts all 102 imported lessons. Existing response fields and authentication semantics remain unchanged.

## Frontend Reading Flow

The app replaces the current single-course, eagerly loaded state with three levels:

1. `CourseSummary[]` loads on app startup and powers the home catalog.
2. Selecting a course loads `CourseDetail` and its lesson summaries. The course's first lesson is selected for the Learn action.
3. Selecting a lesson loads `LessonDetail` and its full Markdown on demand.

Each network operation has independent loading, empty, failure, and retry states. The reading surface provides course switching, a return-to-catalog action, horizontal/mobile-safe chapter navigation, and next/previous lesson navigation where applicable. Cross-course lesson links use `lesson_links` to load the target lesson in-app; external HTTP(S) links open in a new tab with `rel="noreferrer noopener"`.

The Markdown renderer uses `remark-gfm`, `rehype-raw`, and `rehype-sanitize`. The sanitize schema allows headings, paragraphs, emphasis, links, lists, blockquotes, code/pre, tables, `details`/`summary`, and images with `src`/`alt`/`title`; it removes `script`, `iframe`, forms, event-handler attributes, inline `style`, and dangerous URL protocols. Local `res/...` images are resolved against `asset_base_url`, constrained to the reading column width, and preserve aspect ratio. Tables use an overflow wrapper on narrow screens.

The existing authenticated code runner remains available. Only imported Day01–20 lessons render quick checks; lessons 21–102 render a clear no-exercise state. The practice tab remains focused on `python-foundations`.

## Testing and Acceptance

Backend tests must verify:

- exact nine-course and 102-lesson manifest, including merged/duplicate numbering and final lesson 100;
- first sync imports Markdown, maps 20 exercises, preserves users, and clears stale progress;
- second sync is idempotent, preserving course/lesson IDs and progress;
- a changed digest rebuilds all course content in one transaction;
- a missing directory, decode failure, or missing asset aborts without partial rows;
- course list/detail omit Markdown as specified, lesson detail includes Markdown and link mappings, and unknown IDs return 404;
- asset MIME responses succeed while missing, directory, unknown-course, and traversal requests return 404;
- dashboard total is 102 and existing auth/execute/submit behavior still passes.

Frontend tests must verify:

- GFM tables and safe raw HTML images render;
- scripts, event attributes, dangerous protocols, forms, iframes, and inline styles are removed;
- course selection, lesson selection, cross-course link navigation, retry/failure states, Day01 exercise rendering, and Day21 no-exercise rendering work with mocked API responses.

Run `cd backend; uv run python -m unittest discover -s tests -v`, `cd frontend; npm run test`, and `npm run build`. Complete a manual desktop and mobile viewport check for the home catalog, course directory, reading content, image sizing, table overflow, and loading/error states.

## File Boundaries

- `backend/app/course_sync.py`: registry, source discovery, manifest, validation, duration, exercise mapping, and transactional sync.
- `backend/app/models.py`: only relationship/constraint adjustments needed for safe progress cleanup and efficient loading.
- `backend/app/schemas.py`: summary/detail/asset response models.
- `backend/app/main.py`: lifespan sync call, read-only course/lesson/asset endpoints, dashboard total integration; remove old hard-coded seed/API response shapes.
- `backend/content/python-100-days/`: selected Markdown and local image assets.
- `backend/Dockerfile`, `docker-compose.yml`, `README.md`: package content, configure override, and document import/runtime behavior.
- `frontend/src/main.tsx`: API types, load state machine, catalog/course/lesson views, link and exercise behavior.
- `frontend/src/markdown.tsx` (new): reusable sanitized Markdown renderer and URL/link/image transforms.
- `frontend/src/styles.css`: catalog grid, reader states, Markdown tables/images, and responsive navigation styles.
- `frontend/src/i18n.ts`: nine-course bilingual chrome and reading-state copy.
- `frontend/package.json`, `frontend/package-lock.json`: Markdown plugin dependencies.
- `backend/tests/test_course_sync.py` (new), `backend/tests/test_api.py`: synchronizer and HTTP contract coverage.
- `frontend/src/markdown.test.tsx` (new), `frontend/src/main.test.tsx` (new or existing test split): renderer and workflow coverage.
