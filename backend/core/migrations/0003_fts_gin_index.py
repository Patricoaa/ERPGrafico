from django.db import migrations, models


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('core', '0002_remove_companysettings_primary_color_and_more'),
    ]

    def create_gin_index(apps, schema_editor):
        if schema_editor.connection.vendor == 'postgresql':
            schema_editor.execute("""
                CREATE INDEX CONCURRENTLY IF NOT EXISTS core_user_fts_gin
                ON core_user
                USING gin(
                    to_tsvector('simple',
                        coalesce(first_name::text, '') || ' ' ||
                        coalesce(last_name::text, '') || ' ' ||
                        coalesce(email::text, '')
                    )
                );
            """)

    def drop_gin_index(apps, schema_editor):
        if schema_editor.connection.vendor == 'postgresql':
            schema_editor.execute("DROP INDEX IF EXISTS core_user_fts_gin;")

    operations = [
        migrations.RunPython(
            create_gin_index,
            reverse_code=drop_gin_index,
            atomic=True,
        ),
    ]
