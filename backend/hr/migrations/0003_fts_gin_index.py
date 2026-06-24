from django.db import migrations


def create_gin_index(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS hr_payroll_fts_gin
        ON hr_payroll
        USING gin(to_tsvector('simple', coalesce(number::text, '')));
    """)


def drop_gin_index(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute("DROP INDEX IF EXISTS hr_payroll_fts_gin;")


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ("hr", "0002_globalhrsettings_timestampedmodel_t14"),
    ]

    operations = [
        migrations.RunPython(create_gin_index, drop_gin_index),
    ]
