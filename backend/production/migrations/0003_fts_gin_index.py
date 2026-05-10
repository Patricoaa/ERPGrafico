from django.db import migrations


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('production', '0002_initial'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE INDEX CONCURRENTLY IF NOT EXISTS production_workorder_fts_gin
            ON production_workorder
            USING gin(
                to_tsvector('simple',
                    coalesce(number::text, '') || ' ' ||
                    coalesce(description::text, '')
                )
            );
            """,
            reverse_sql="DROP INDEX IF EXISTS production_workorder_fts_gin;",
        ),
    ]
