"""Data migration: merge duplicate Permission rows.

Depends on the finances migration (so the correct CT for
``view_dashboard_finances`` exists) and on the latest tax migration.
"""

from django.db import migrations


def forwards(apps, schema_editor):
    from core.migrations.helpers.merge_duplicate_permissions import (
        merge_duplicate_permissions,
    )

    deleted = merge_duplicate_permissions()
    if deleted:
        print(f"\n  Merged {deleted} duplicate permission(s).")


def backwards(apps, schema_editor):
    # Reverse is a no-op: we cannot recreate the duplicates.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0013_remove_backgroundjob_deleted_at_and_more"),
        ("finances", "0003_financespermissions"),
        ("tax", "0008_payment_status"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards, elidable=True),
    ]
