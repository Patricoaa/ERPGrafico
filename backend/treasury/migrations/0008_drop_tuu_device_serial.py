from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('treasury', '0007_simplified_payment_methods'),
    ]

    operations = [
        migrations.RunSQL(
            sql=[
                "ALTER TABLE treasury_posterminal DROP COLUMN IF EXISTS tuu_device_serial CASCADE;",
                "ALTER TABLE treasury_historicalposterminal DROP COLUMN IF EXISTS tuu_device_serial CASCADE;",
            ],
            reverse_sql=[
                "ALTER TABLE treasury_posterminal ADD COLUMN IF NOT EXISTS tuu_device_serial VARCHAR(100) NULL;",
                "ALTER TABLE treasury_historicalposterminal ADD COLUMN IF NOT EXISTS tuu_device_serial VARCHAR(100) NULL;",
            ],
        ),
    ]
