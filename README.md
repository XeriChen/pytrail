# PyTrail

PyTrail is a modern, responsive Python learning platform built as a small full-stack monorepo.

## Stack

- Web: React 19, TypeScript 7, Vite 8, React Router, CodeMirror 6, React Markdown, Prism, Mermaid, Lucide icons
- API: FastAPI, SQLAlchemy 2, Pydantic 2, RestrictedPython, JWT authentication, SQLite by default
- Production database: set `DATABASE_URL` to a PostgreSQL connection string such as `postgresql+psycopg://user:password@host/db`
- Course content: 9 courses / 102 lessons plus 36 curriculum-linked function exercises synced into SQLite at startup
- Delivery: Docker Compose for local deployment and GitHub Actions for CI

## Structure

```text
.
├── backend/
│   ├── app/
│   │   ├── auth.py        # password hashing, JWT, current-user dependency
│   │   ├── course_sync.py  # content-tree -> DB sync, content index
│   │   ├── database.py    # SQLAlchemy engine/session
│   │   ├── main.py        # REST endpoints
│   │   ├── models.py      # User, Course, Lesson, Exercise, Progress
│   │   ├── practice_runner.py # isolated restricted function runner
│   │   ├── practice_service.py # catalog filters and learner progress
│   │   └── schemas.py     # Pydantic request/response models
│   ├── content/          # Markdown courses and curated practice manifests
│   ├── Dockerfile
│   ├── pyproject.toml   # project metadata and dependencies
│   └── uv.lock          # reproducible dependency lockfile
├── frontend/
│   ├── src/main.tsx       # app shell, views, auth and API client
│   ├── src/markdown.tsx   # sanitized markdown, highlighted code, diagrams
│   ├── src/practice/      # routed catalog and split exercise workspace
│   ├── src/theme.ts       # system-aware persisted light/dark theme
│   ├── src/styles.css     # responsive light and dark UI
│   └── package.json
├── docker-compose.yml
└── .github/workflows/ci.yml
```

## Run locally

### API

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

`uv sync` creates and manages the local `.venv` automatically. Add or update dependencies with `uv add <package>` and refresh the lockfile with `uv lock`.

At startup the API reads the Markdown course tree under `backend/content/python-100-days/` and the nine manifests under `backend/content/practice/`, then syncs both into the database with an idempotent single-transaction rebuild. To point at an alternative course location, set `COURSE_CONTENT_ROOT` to an absolute path before launch.

This release intentionally uses a fresh schema and contains no compatibility migration for older local databases. Start it with a newly created database. When course Markdown or a practice manifest changes, the catalog is rebuilt transactionally and both lesson and exercise progress are cleared; user accounts are preserved.

### Web

```bash
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173`. The API Swagger docs are available at `http://localhost:8000/docs`.

The practice lab lives at `/practice`. It offers 36 public function exercises, four for each course, with search and curriculum/difficulty/tag/progress filters. `/practice/:slug` opens a dedicated statement/editor/results workspace. Browsing is public; running code and saving the current status, attempt count, and latest code require login.

The reader follows the operating-system light/dark preference until a theme is selected from the sidebar, then saves that explicit choice locally. Fenced code blocks are highlighted with language labels and copy controls. Python, Shell/Bash, SQL/Hive, HTML/XML, JSON, JavaScript, INI, Java, PowerShell, Dockerfile, and Nginx aliases are recognized; unknown languages remain readable plain text.

Fenced `mermaid` blocks render client-side with theme-aware colors, bounded zoom, reset, and full-screen controls. Mermaid is loaded only when a diagram is present and uses `securityLevel: "strict"`; invalid diagrams fall back to their original source.

For LAN access, open `http://<host-ip>:5173`. Vite proxies same-origin `/api` requests to FastAPI. On Windows, run `scripts/configure-windows-lan.ps1` as Administrator once to mark the active network as private and allow TCP ports 5173 and 8000 from the local subnet.

## Docker deployment

```bash
docker compose up --build
```

For production, replace the SQLite URL with PostgreSQL, set a long random `SECRET_KEY`, set `PYTRAIL_ENV=production`, restrict `CORS_ORIGINS`, and serve the Vite build behind an HTTPS reverse proxy. A managed Postgres database plus a container platform (Render, Fly.io, ECS, or Kubernetes) works with the same environment variables.

A known-default `SECRET_KEY` (`dev-only-change-me`, or the old compose placeholder) prints a conspicuous warning in development and **refuses to start** when `PYTRAIL_ENV=production` (or `ENV=production`). Compose reads `SECRET_KEY` from the host environment / `.env` and falls back to the demo default so `docker compose up` still works locally.

Login and register are rate-limited per client IP (5 attempts per minute) to slow credential stuffing.

Practice runs are limited to 20 per minute for each user/IP pair. A submission may contain at most 12 KB of Python and receives a two-second total timeout. Only deterministic function implementations and a curated builtin set are available. Imports, files, network access, process creation, interactive input, private attribute traversal, and dynamic evaluation are rejected. The runner evaluates only the public examples shown in the workspace; there are no hidden tests, rankings, or submission history.

## API surface

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/courses` (summary list), `GET /api/courses/{id}` (course + lesson summaries)
- `GET /api/lessons/{id}` (full lesson markdown + exercises + asset base URL + lesson links)
- `GET /api/course-assets/{course_slug}/{path}` (serves images and other assets from a course's `res/` tree)
- `GET /api/dashboard`, `POST /api/progress`
- `POST /api/exercises/{id}/submit`
- `GET /api/practice/exercises` (public searchable/filterable paginated catalog)
- `GET /api/practice/exercises/{slug}` (public statement, signature, starter code, and examples)
- `POST /api/practice/exercises/{slug}/run` (authenticated restricted public-example run and progress update)
- `POST /api/execute` (requires a signed-in user; 2 second timeout, 4 KB code limit for the demo runner)

The legacy lesson playground at `/api/execute` remains a local-demo implementation and is not used by the practice lab. The practice runner uses RestrictedPython in a separate child process with bounded JSON input/output and a hard timeout. For hostile public deployment, move execution into isolated ephemeral containers or a sandbox service with OS-level CPU, memory, filesystem, and network limits.
