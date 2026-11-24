from django.db import migrations, models


def status_to_is_active(apps, schema_editor):
    for name in ("Employee", "HistoricalEmployee"):
        model = apps.get_model("hr", name)
        model.objects.filter(status="INACTIVE").update(is_active=False)


def is_active_to_status(apps, schema_editor):
    for name in ("Employee", "HistoricalEmployee"):
        model = apps.get_model("hr", name)
        model.objects.filter(is_active=False).update(status="INACTIVE")


class Migration(migrations.Migration):
    """Employee pasa de `status` ACTIVE/INACTIVE al patrón Archivo (`is_active`). ADR-0154."""

    dependencies = [
        ("hr", "0014_add_absence_historical_records"),
    ]

    operations = [
        migrations.AddField(
            model_name="employee",
            name="is_active",
            field=models.BooleanField(db_index=True, default=True, verbose_name="Activo"),
        ),
        migrations.AddField(
            model_name="historicalemployee",
            name="is_active",
            field=models.BooleanField(db_index=True, default=True, verbose_name="Activo"),
        ),
        migrations.RunPython(status_to_is_active, is_active_to_status),
        migrations.RemoveField(model_name="employee", name="status"),
        migrations.RemoveField(model_name="historicalemployee", name="status"),
    ]
