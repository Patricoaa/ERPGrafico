from django.db import migrations


def create_account_gin_index(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS accounting_account_fts_gin
        ON accounting_account
        USING gin(
            to_tsvector('simple',
                coalesce(code::text, '') || ' ' ||
                coalesce(name::text, '')
            )
        );
    """)


def create_journalentry_gin_index(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS accounting_journalentry_fts_gin
        ON accounting_journalentry
        USING gin(
            to_tsvector('simple',
                coalesce(number::text, '') || ' ' ||
                coalesce(description::text, '')
            )
        );
    """)


def drop_account_gin_index(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute("DROP INDEX IF EXISTS accounting_account_fts_gin;")


def drop_journalentry_gin_index(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute("DROP INDEX IF EXISTS accounting_journalentry_fts_gin;")


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ("accounting", "0015_journalentry_accounting__source__1c8e9a_idx"),
    ]

    operations = [
        migrations.RunPython(create_account_gin_index, drop_account_gin_index),
        migrations.RunPython(create_journalentry_gin_index, drop_journalentry_gin_index),
    ]
