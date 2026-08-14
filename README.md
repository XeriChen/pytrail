# PyTrail

PyTrail is a modern, responsive Python learning platform built as a small full-stack monorepo.

## Stack

- Web: React 19, TypeScript 7, Vite 8, React Markdown, Prism, Mermaid, Lucide icons
- API: FastAPI, SQLAlchemy 2, Pydantic 2, JWT authentication, SQLite by default
- Production database: set `DATABASE_URL` to a PostgreSQL connection string such as `postgresql+psycopg://user:password@host/db`
- Course content: 9 courses / 102 lessons synced from a Markdown content tree into SQLite at startup
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
│   │   └── schemas.py     # Pydantic request/response models
│   ├── content/          # Markdown course tree (python-100-days/*)
│   ├── Dockerfile
│   ├── pyproject.toml   # project metadata and dependencies
│   └── uv.lock          # reproducible dependency lockfile
├── frontend/
│   ├── src/main.tsx       # app shell, views, auth and API client
│   ├── src/markdown.tsx   # sanitized markdown, highlighted code, diagrams
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

At startup the API reads the Markdown course tree under `backend/content/python-100-days/` and syncs it into the database (idempotent, single-transaction rebuild). To point at an alternative content location, set `COURSE_CONTENT_ROOT` to an absolute path before launch.

### Web

```bash
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173`. The API Swagger docs are available at `http://localhost:8000/docs`.

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

## API surface

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/courses` (summary list), `GET /api/courses/{id}` (course + lesson summaries)
- `GET /api/lessons/{id}` (full lesson markdown + exercises + asset base URL + lesson links)
- `GET /api/course-assets/{course_slug}/{path}` (serves images and other assets from a course's `res/` tree)
- `GET /api/dashboard`, `POST /api/progress`
- `POST /api/exercises/{id}/submit`
- `POST /api/execute` (requires a signed-in user; 2 second timeout, 4 KB code limit for the demo runner)

The code runner is intentionally a local-demo implementation and now requires authentication so anonymous visitors cannot trigger it. Full process isolation (ephemeral containers / gVisor / nsjail) is still out of scope for this demo. For public production use, move execution into isolated, ephemeral containers or a sandbox service with CPU, memory, filesystem, and network limits.
