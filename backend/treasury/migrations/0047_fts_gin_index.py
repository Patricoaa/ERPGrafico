from django.db import migrations


def create_gin_index(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    schema_editor.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS treasury_treasuryaccount_fts_gin
        ON treasury_treasuryaccount
        USING gin(
            to_tsvector('simple',
                coalesce(name::text, '') || ' ' ||
                coalesce(account_number::text, '')
            )
        );
    """)


def drop_gin_index(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    schema_editor.execute("DROP INDEX IF EXISTS treasury_treasuryaccount_fts_gin;")


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('treasury', '0046_t42_gfk_data_migration'),
    ]

    operations = [
        migrations.RunPython(create_gin_index, drop_gin_index),
    ]
