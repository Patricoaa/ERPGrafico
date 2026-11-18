"""Borra la entrada de Beat de la tarea retirada ``tax.tasks.run_fiscal_reconciliation``.

Beat usa ``DatabaseScheduler``: al arrancar crea o actualiza las entradas de
``CELERY_BEAT_SCHEDULE`` (``run_fiscal_match_10min``), pero no borra las filas que ya no
están ahí. Sin esta migración, Beat seguiría enviando una tarea que no existe.
"""

from django.db import migrations

OLD_TASK = "tax.tasks.run_fiscal_reconciliation"


def remove_old_beat_entries(apps, schema_editor):
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    PeriodicTask.objects.filter(task=OLD_TASK).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("tax", "0010_fiscalmatch_backfill"),
        ("django_celery_beat", "0019_alter_periodictasks_options"),
    ]

    operations = [
        migrations.RunPython(remove_old_beat_entries, migrations.RunPython.noop),
    ]
