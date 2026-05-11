from django.db import migrations


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('accounting', '0015_journalentry_accounting__source__1c8e9a_idx'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE INDEX CONCURRENTLY IF NOT EXISTS accounting_account_fts_gin
            ON accounting_account
            USING gin(
                to_tsvector('simple',
                    coalesce(code::text, '') || ' ' ||
                    coalesce(name::text, '')
                )
            );
            """,
            reverse_sql="DROP INDEX IF EXISTS accounting_account_fts_gin;",
        ),
        migrations.RunSQL(
            sql="""
            CREATE INDEX CONCURRENTLY IF NOT EXISTS accounting_journalentry_fts_gin
            ON accounting_journalentry
            USING gin(
                to_tsvector('simple',
                    coalesce(number::text, '') || ' ' ||
                    coalesce(description::text, '')
                )
            );
            """,
            reverse_sql="DROP INDEX IF EXISTS accounting_journalentry_fts_gin;",
        ),
    ]
