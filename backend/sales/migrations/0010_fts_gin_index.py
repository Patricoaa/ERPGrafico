from django.db import migrations


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('sales', '0009_alter_saledelivery_options_alter_saleorder_options_and_more'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE INDEX CONCURRENTLY IF NOT EXISTS sales_saleorder_fts_gin
            ON sales_saleorder
            USING gin(to_tsvector('simple', coalesce(number::text, '')));
            """,
            reverse_sql="DROP INDEX IF EXISTS sales_saleorder_fts_gin;",
        ),
        migrations.RunSQL(
            sql="""
            CREATE INDEX CONCURRENTLY IF NOT EXISTS sales_saledelivery_fts_gin
            ON sales_saledelivery
            USING gin(to_tsvector('simple', coalesce(number::text, '')));
            """,
            reverse_sql="DROP INDEX IF EXISTS sales_saledelivery_fts_gin;",
        ),
        migrations.RunSQL(
            sql="""
            CREATE INDEX CONCURRENTLY IF NOT EXISTS sales_salereturn_fts_gin
            ON sales_salereturn
            USING gin(to_tsvector('simple', coalesce(number::text, '')));
            """,
            reverse_sql="DROP INDEX IF EXISTS sales_salereturn_fts_gin;",
        ),
    ]
