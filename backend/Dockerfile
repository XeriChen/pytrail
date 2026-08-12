FROM python:3.14-slim
WORKDIR /app
COPY --from=ghcr.io/astral-sh/uv:0.11.26 /uv /uvx /bin/
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY app ./app
RUN mkdir -p /app/data
ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
