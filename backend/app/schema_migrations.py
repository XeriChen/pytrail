"""Small, versioned additive migrations for existing PyTrail databases."""

from __future__ import annotations

from sqlalchemy import Column, Engine, Integer, MetaData, String, Table, Text, inspect, insert, select
from sqlalchemy.schema import CreateColumn

from .database import Base
from . import models as _models  # noqa: F401 - register all mapped tables


PRACTICE_SCHEMA_VERSION = 1

_migration_metadata = MetaData()
schema_migrations = Table(
    "schema_migrations",
    _migration_metadata,
    Column("version", Integer, primary_key=True),
)


def _add_column_if_missing(connection, table_name: str, column: Column) -> None:
    columns = {item["name"] for item in inspect(connection).get_columns(table_name)}
    if column.name in columns:
        return
    table = connection.dialect.identifier_preparer.quote(table_name)
    definition = str(CreateColumn(column).compile(dialect=connection.dialect))
    connection.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {definition}")


def _create_new_tables_and_indexes(connection) -> None:
    new_tables = [
        Base.metadata.tables[name]
        for name in ("tags", "exercise_cases", "exercise_tags", "exercise_progress")
    ]
    Base.metadata.create_all(connection, tables=new_tables, checkfirst=True)
    for table_name in ("lessons", "exercises"):
        for index in Base.metadata.tables[table_name].indexes:
            index.create(connection, checkfirst=True)


def upgrade_schema(engine: Engine) -> None:
    """Upgrade both fresh and legacy SQLite/PostgreSQL databases in place."""

    # Ensure the legacy base tables exist on a fresh database. Existing tables are
    # intentionally skipped so the additive migration below can preserve rows.
    Base.metadata.create_all(engine)
    _migration_metadata.create_all(engine)
    with engine.begin() as connection:
        applied = set(connection.scalars(select(schema_migrations.c.version)))
        if PRACTICE_SCHEMA_VERSION in applied:
            return

        _add_column_if_missing(connection, "lessons", Column("source_path", String(512), nullable=True))
        _add_column_if_missing(connection, "exercises", Column("slug", String(180), nullable=True))
        _add_column_if_missing(
            connection,
            "exercises",
            Column("kind", String(24), nullable=False, server_default="quick_check"),
        )
        _add_column_if_missing(
            connection,
            "exercises",
            Column("title", String(180), nullable=False, server_default=""),
        )
        _add_column_if_missing(connection, "exercises", Column("difficulty", String(20), nullable=True))
        _add_column_if_missing(connection, "exercises", Column("function_name", String(80), nullable=True))
        _add_column_if_missing(
            connection,
            "exercises",
            Column("signature_json", Text, nullable=False, server_default="{}"),
        )
        _add_column_if_missing(
            connection,
            "exercises",
            Column("order", Integer, nullable=False, server_default="1"),
        )
        _create_new_tables_and_indexes(connection)
        connection.execute(insert(schema_migrations).values(version=PRACTICE_SCHEMA_VERSION))
