from django.db import migrations


def create_saleorder_gin_index(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    schema_editor.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS sales_saleorder_fts_gin
        ON sales_saleorder
        USING gin(to_tsvector('simple', coalesce(number::text, '')));
    """)


def create_saledelivery_gin_index(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    schema_editor.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS sales_saledelivery_fts_gin
        ON sales_saledelivery
        USING gin(to_tsvector('simple', coalesce(number::text, '')));
    """)


def create_salereturn_gin_index(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    schema_editor.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS sales_salereturn_fts_gin
        ON sales_salereturn
        USING gin(to_tsvector('simple', coalesce(number::text, '')));
    """)


def drop_saleorder_gin_index(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    schema_editor.execute("DROP INDEX IF EXISTS sales_saleorder_fts_gin;")


def drop_saledelivery_gin_index(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    schema_editor.execute("DROP INDEX IF EXISTS sales_saledelivery_fts_gin;")


def drop_salereturn_gin_index(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    schema_editor.execute("DROP INDEX IF EXISTS sales_salereturn_fts_gin;")


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('sales', '0009_alter_saledelivery_options_alter_saleorder_options_and_more'),
    ]

    operations = [
        migrations.RunPython(create_saleorder_gin_index, drop_saleorder_gin_index),
        migrations.RunPython(create_saledelivery_gin_index, drop_saledelivery_gin_index),
        migrations.RunPython(create_salereturn_gin_index, drop_salereturn_gin_index),
    ]
