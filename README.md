# PyTrail

PyTrail is a modern, responsive Python learning platform built as a small full-stack monorepo.

## Stack

- Web: React 19, TypeScript 7, Vite 8, React Markdown, Lucide icons
- API: FastAPI, SQLAlchemy 2, Pydantic 2, JWT authentication, SQLite by default
- Production database: set `DATABASE_URL` to a PostgreSQL connection string such as `postgresql+psycopg://user:password@host/db`
- Delivery: Docker Compose for local deployment and GitHub Actions for CI

## Structure

```text
.
├── backend/
│   ├── app/
│   │   ├── auth.py       # password hashing, JWT, current-user dependency
│   │   ├── database.py   # SQLAlchemy engine/session
│   │   ├── main.py       # REST endpoints and seed content
│   │   ├── models.py     # User, Course, Lesson, Exercise, Progress
│   │   └── schemas.py    # Pydantic request/response models
│   ├── Dockerfile
│   ├── pyproject.toml   # project metadata and dependencies
│   └── uv.lock          # reproducible dependency lockfile
├── frontend/
│   ├── src/main.tsx      # app shell, views, auth and API client
│   ├── src/styles.css    # responsive dark UI
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

### Web

```bash
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173`. The API Swagger docs are available at `http://localhost:8000/docs`.

## Docker deployment

```bash
docker compose up --build
```

For production, replace the SQLite URL with PostgreSQL, set a long random `SECRET_KEY`, restrict `CORS_ORIGINS`, and serve the Vite build behind an HTTPS reverse proxy. A managed Postgres database plus a container platform (Render, Fly.io, ECS, or Kubernetes) works with the same environment variables.

## API surface

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/courses`, `GET /api/courses/{id}`
- `GET /api/dashboard`, `POST /api/progress`
- `POST /api/exercises/{id}/submit`
- `POST /api/execute` (2 second timeout, 4 KB code limit for the demo runner)

The code runner is intentionally a local-demo implementation. For public production use, move execution into isolated, ephemeral containers or a sandbox service with CPU, memory, filesystem, and network limits.
