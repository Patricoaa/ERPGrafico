# Generated to repair historical tables where migration 0060 was recorded as
# applied but the simple_history mirror columns were never physically created.
#
# Affected:
#   - treasury_historicalposterminal.allows_check        (boolean NOT NULL)
#   - treasury_historicalpossession.total_check_sales    (numeric(12,2) NOT NULL)
#
# Idempotent via ADD COLUMN IF NOT EXISTS (PostgreSQL 9.6+). On other vendors
# (SQLite local test runs) 0060 applies normally, so no repair is needed.

from django.db import migrations


def repair_historical_columns(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute(
        'ALTER TABLE "treasury_historicalposterminal" '
        'ADD COLUMN IF NOT EXISTS "allows_check" boolean NOT NULL DEFAULT FALSE;'
    )
    schema_editor.execute(
        'ALTER TABLE "treasury_historicalpossession" '
        'ADD COLUMN IF NOT EXISTS "total_check_sales" numeric(12, 2) NOT NULL DEFAULT 0;'
    )


class Migration(migrations.Migration):
    dependencies = [
        ("treasury", "0060_pos_terminal_allows_check_pos_session_total_check_sales"),
    ]

    operations = [
        migrations.RunPython(repair_historical_columns, migrations.RunPython.noop),
    ]
