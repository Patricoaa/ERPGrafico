from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('treasury', '0008_drop_tuu_device_serial'),
    ]

    operations = [
        migrations.RunSQL(
            sql=[
                "ALTER TABLE treasury_posterminal DROP COLUMN IF EXISTS tuu_enabled CASCADE;",
                "ALTER TABLE treasury_posterminal DROP COLUMN IF EXISTS tuu_api_key CASCADE;",
                "ALTER TABLE treasury_posterminal DROP COLUMN IF EXISTS tuu_terminal_id CASCADE;",
                
                "ALTER TABLE treasury_historicalposterminal DROP COLUMN IF EXISTS tuu_enabled CASCADE;",
                "ALTER TABLE treasury_historicalposterminal DROP COLUMN IF EXISTS tuu_api_key CASCADE;",
                "ALTER TABLE treasury_historicalposterminal DROP COLUMN IF EXISTS tuu_terminal_id CASCADE;",
            ],
            reverse_sql=[
                "ALTER TABLE treasury_posterminal ADD COLUMN IF NOT EXISTS tuu_enabled BOOLEAN DEFAULT FALSE;",
                "ALTER TABLE treasury_historicalposterminal ADD COLUMN IF NOT EXISTS tuu_enabled BOOLEAN DEFAULT FALSE;",
            ],
        ),
    ]
