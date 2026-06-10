from django.db import migrations


def create_gin_index(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    schema_editor.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS billing_invoice_fts_gin
        ON billing_invoice
        USING gin(to_tsvector('simple', coalesce(number::text, '')));
    """)


def drop_gin_index(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    schema_editor.execute("DROP INDEX IF EXISTS billing_invoice_fts_gin;")


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('billing', '0011_t43_gfk_data_migration'),
    ]

    operations = [
        migrations.RunPython(create_gin_index, drop_gin_index),
    ]
