from django.db import migrations


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('billing', '0011_t43_gfk_data_migration'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE INDEX CONCURRENTLY IF NOT EXISTS billing_invoice_fts_gin
            ON billing_invoice
            USING gin(to_tsvector('simple', coalesce(number::text, '')));
            """,
            reverse_sql="DROP INDEX IF EXISTS billing_invoice_fts_gin;",
        ),
    ]
