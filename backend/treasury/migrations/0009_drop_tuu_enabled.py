from django.db import migrations


def drop_tuu_columns(apps, schema_editor):
    vendor = schema_editor.connection.vendor
    tables = ["treasury_posterminal", "treasury_historicalposterminal"]
    columns = ["tuu_enabled", "tuu_api_key", "tuu_terminal_id"]

    if vendor == "postgresql":
        for table in tables:
            for col in columns:
                schema_editor.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS {col} CASCADE;")
    elif vendor == "sqlite":
        for table in tables:
            for col in columns:
                try:
                    schema_editor.execute(f"ALTER TABLE {table} DROP COLUMN {col};")
                except Exception:
                    pass


def reverse_drop_tuu_columns(apps, schema_editor):
    vendor = schema_editor.connection.vendor
    if vendor == "postgresql":
        schema_editor.execute(
            "ALTER TABLE treasury_posterminal ADD COLUMN IF NOT EXISTS tuu_enabled BOOLEAN DEFAULT FALSE;"
        )
        schema_editor.execute(
            "ALTER TABLE treasury_historicalposterminal ADD COLUMN IF NOT EXISTS tuu_enabled BOOLEAN DEFAULT FALSE;"
        )
    elif vendor == "sqlite":
        try:
            schema_editor.execute(
                "ALTER TABLE treasury_posterminal ADD COLUMN tuu_enabled BOOLEAN DEFAULT FALSE;"
            )
        except Exception:
            pass
        try:
            schema_editor.execute(
                "ALTER TABLE treasury_historicalposterminal ADD COLUMN tuu_enabled BOOLEAN DEFAULT FALSE;"
            )
        except Exception:
            pass


class Migration(migrations.Migration):
    dependencies = [
        ("treasury", "0008_drop_tuu_device_serial"),
    ]

    operations = [
        migrations.RunPython(drop_tuu_columns, reverse_drop_tuu_columns),
    ]
