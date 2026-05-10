from django.db import migrations


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('treasury', '0046_t42_gfk_data_migration'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE INDEX CONCURRENTLY IF NOT EXISTS treasury_treasuryaccount_fts_gin
            ON treasury_treasuryaccount
            USING gin(
                to_tsvector('simple',
                    coalesce(name::text, '') || ' ' ||
                    coalesce(account_number::text, '')
                )
            );
            """,
            reverse_sql="DROP INDEX IF EXISTS treasury_treasuryaccount_fts_gin;",
        ),
    ]
