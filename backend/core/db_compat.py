"""
Database compatibility helpers.

Provides PostgreSQL-specific types with safe fallbacks for non-PostgreSQL
databases (e.g. SQLite used during local testing).
"""

from django.db import connection, models


def is_postgres():
    return connection.vendor == "postgresql"


class SearchVectorField(models.Field):
    """Postgres tsvector with safe fallback to TextField on SQLite."""

    def db_type(self, connection):
        if connection.vendor == "postgresql":
            from django.contrib.postgres.search import SearchVectorField as PgField

            return PgField().db_type(connection)
        return "text"


class GinIndex(models.Index):
    """Postgres GIN index — regular B-tree index on SQLite."""

    def create_sql(self, model, schema_editor, **kwargs):
        if schema_editor.connection.vendor == "postgresql":
            from django.contrib.postgres.indexes import GinIndex as PgGin

            return PgGin(fields=self.fields, name=self.name).create_sql(
                model, schema_editor, **kwargs
            )
        return super().create_sql(model, schema_editor, **kwargs)

    def remove_sql(self, model, schema_editor, **kwargs):
        if schema_editor.connection.vendor == "postgresql":
            from django.contrib.postgres.indexes import GinIndex as PgGin

            return PgGin(fields=self.fields, name=self.name).remove_sql(
                model, schema_editor, **kwargs
            )
        return super().remove_sql(model, schema_editor, **kwargs)
