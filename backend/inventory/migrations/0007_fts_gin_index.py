from django.db import migrations


def create_product_gin_index(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS inventory_product_fts_gin
        ON inventory_product
        USING gin(
            to_tsvector('simple',
                coalesce(name::text, '') || ' ' ||
                coalesce(code::text, '') || ' ' ||
                coalesce(internal_code::text, '')
            )
        );
    """)


def create_stockmove_gin_index(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS inventory_stockmove_fts_gin
        ON inventory_stockmove
        USING gin(
            to_tsvector('simple',
                coalesce(description::text, '') || ' ' ||
                coalesce(adjustment_reason::text, '')
            )
        );
    """)


def drop_product_gin_index(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute("DROP INDEX IF EXISTS inventory_product_fts_gin;")


def drop_stockmove_gin_index(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute("DROP INDEX IF EXISTS inventory_stockmove_fts_gin;")


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ("inventory", "0006_t44_backfill_mfg_profile"),
    ]

    operations = [
        migrations.RunPython(create_product_gin_index, drop_product_gin_index),
        migrations.RunPython(create_stockmove_gin_index, drop_stockmove_gin_index),
    ]
