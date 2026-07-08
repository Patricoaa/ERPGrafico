from django.db import migrations


def create_gin_index(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS production_workorder_fts_gin
        ON production_workorder
        USING gin(
            to_tsvector('simple',
                coalesce(number::text, '') || ' ' ||
                coalesce(description::text, '')
            )
        );
    """)


def drop_gin_index(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute("DROP INDEX IF EXISTS production_workorder_fts_gin;")


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ("production", "0002_initial"),
    ]

    operations = [
        migrations.RunPython(create_gin_index, drop_gin_index),
    ]
