from django.db import migrations


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('purchasing', '0004_historicalpurchasereceipt_total_and_more'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE INDEX CONCURRENTLY IF NOT EXISTS purchasing_purchaseorder_fts_gin
            ON purchasing_purchaseorder
            USING gin(to_tsvector('simple', coalesce(number::text, '')));
            """,
            reverse_sql="DROP INDEX IF EXISTS purchasing_purchaseorder_fts_gin;",
        ),
    ]
