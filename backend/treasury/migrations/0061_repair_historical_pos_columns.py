# Generated to repair historical tables where migration 0060 was recorded as
# applied but the simple_history mirror columns were never physically created.
#
# Affected:
#   - treasury_historicalposterminal.allows_check        (boolean NOT NULL)
#   - treasury_historicalpossession.total_check_sales    (numeric(12,2) NOT NULL)
#
# Idempotent via ADD COLUMN IF NOT EXISTS (PostgreSQL 9.6+).

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('treasury', '0060_pos_terminal_allows_check_pos_session_total_check_sales'),
    ]

    operations = [
        migrations.RunSQL(
            sql='ALTER TABLE "treasury_historicalposterminal" ADD COLUMN IF NOT EXISTS "allows_check" boolean NOT NULL DEFAULT FALSE;',
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            sql='ALTER TABLE "treasury_historicalpossession" ADD COLUMN IF NOT EXISTS "total_check_sales" numeric(12, 2) NOT NULL DEFAULT 0;',
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
