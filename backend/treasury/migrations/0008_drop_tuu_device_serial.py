from django.db import migrations


def drop_tuu_device_serial(apps, schema_editor):
    vendor = schema_editor.connection.vendor
    if vendor == "postgresql":
        schema_editor.execute(
            "ALTER TABLE treasury_posterminal DROP COLUMN IF EXISTS tuu_device_serial CASCADE;"
        )
        schema_editor.execute(
            "ALTER TABLE treasury_historicalposterminal DROP COLUMN IF EXISTS tuu_device_serial CASCADE;"
        )
    elif vendor == "sqlite":
        for table in ("treasury_posterminal", "treasury_historicalposterminal"):
            try:
                schema_editor.execute(f"ALTER TABLE {table} DROP COLUMN tuu_device_serial;")
            except Exception:
                pass


def reverse_drop_tuu_device_serial(apps, schema_editor):
    vendor = schema_editor.connection.vendor
    if vendor == "postgresql":
        schema_editor.execute(
            "ALTER TABLE treasury_posterminal ADD COLUMN IF NOT EXISTS tuu_device_serial VARCHAR(100) NULL;"
        )
        schema_editor.execute(
            "ALTER TABLE treasury_historicalposterminal ADD COLUMN IF NOT EXISTS tuu_device_serial VARCHAR(100) NULL;"
        )
    elif vendor == "sqlite":
        for table in ("treasury_posterminal", "treasury_historicalposterminal"):
            try:
                schema_editor.execute(
                    f"ALTER TABLE {table} ADD COLUMN tuu_device_serial VARCHAR(100) NULL;"
                )
            except Exception:
                pass


class Migration(migrations.Migration):
    dependencies = [
        ("treasury", "0007_simplified_payment_methods"),
    ]

    operations = [
        migrations.RunPython(drop_tuu_device_serial, reverse_drop_tuu_device_serial),
    ]
