from django.db import migrations


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('inventory', '0006_t44_backfill_mfg_profile'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE INDEX CONCURRENTLY IF NOT EXISTS inventory_product_fts_gin
            ON inventory_product
            USING gin(
                to_tsvector('simple',
                    coalesce(name::text, '') || ' ' ||
                    coalesce(code::text, '') || ' ' ||
                    coalesce(internal_code::text, '')
                )
            );
            """,
            reverse_sql="DROP INDEX IF EXISTS inventory_product_fts_gin;",
        ),
        migrations.RunSQL(
            sql="""
            CREATE INDEX CONCURRENTLY IF NOT EXISTS inventory_stockmove_fts_gin
            ON inventory_stockmove
            USING gin(
                to_tsvector('simple',
                    coalesce(description::text, '') || ' ' ||
                    coalesce(adjustment_reason::text, '')
                )
            );
            """,
            reverse_sql="DROP INDEX IF EXISTS inventory_stockmove_fts_gin;",
        ),
    ]
