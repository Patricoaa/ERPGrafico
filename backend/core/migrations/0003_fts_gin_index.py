from django.db import migrations


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('core', '0002_remove_companysettings_primary_color_and_more'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE INDEX CONCURRENTLY IF NOT EXISTS core_user_fts_gin
            ON core_user
            USING gin(
                to_tsvector('simple',
                    coalesce(first_name::text, '') || ' ' ||
                    coalesce(last_name::text, '') || ' ' ||
                    coalesce(email::text, '')
                )
            );
            """,
            reverse_sql="DROP INDEX IF EXISTS core_user_fts_gin;",
        ),
    ]
