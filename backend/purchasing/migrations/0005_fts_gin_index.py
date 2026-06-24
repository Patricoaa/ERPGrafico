from django.db import migrations


def create_gin_index(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS purchasing_purchaseorder_fts_gin
        ON purchasing_purchaseorder
        USING gin(to_tsvector('simple', coalesce(number::text, '')));
    """)


def drop_gin_index(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute("DROP INDEX IF EXISTS purchasing_purchaseorder_fts_gin;")


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ("purchasing", "0004_historicalpurchasereceipt_total_and_more"),
    ]

    operations = [
        migrations.RunPython(create_gin_index, drop_gin_index),
    ]
