from django.db import migrations


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('hr', '0002_globalhrsettings_timestampedmodel_t14'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE INDEX CONCURRENTLY IF NOT EXISTS hr_payroll_fts_gin
            ON hr_payroll
            USING gin(to_tsvector('simple', coalesce(number::text, '')));
            """,
            reverse_sql="DROP INDEX IF EXISTS hr_payroll_fts_gin;",
        ),
    ]
