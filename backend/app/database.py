import os

from sqlalchemy import create_engine, event
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./learning.db")
IS_SQLITE = DATABASE_URL.startswith("sqlite")
connect_args = {"check_same_thread": False} if IS_SQLITE else {}
# Server databases can drop idle pooled connections (restarts, proxies,
# idle timeouts); pre-ping replaces a dead connection instead of failing
# the next request. SQLite has no network connection to lose.
engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=not IS_SQLITE,
    future=True,
)


if IS_SQLITE:

    @event.listens_for(engine, "connect")
    def _enable_sqlite_foreign_keys(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


def dialect_insert(dialect: str, table, purpose: str):
    """Return an INSERT that supports ON CONFLICT for a supported dialect.

    SQLite and PostgreSQL are the only supported databases; every atomic
    upsert goes through here so a new dialect fails loudly in one place.
    """
    if dialect == "sqlite":
        return sqlite_insert(table)
    if dialect == "postgresql":
        return postgresql_insert(table)
    raise RuntimeError(f"Unsupported database dialect for {purpose}: {dialect}")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
