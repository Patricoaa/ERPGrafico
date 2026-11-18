"""Migración 0011: borra la entrada de Beat de la tarea retirada."""

import importlib

import pytest
from django.apps import apps
from django_celery_beat.models import IntervalSchedule, PeriodicTask

migration = importlib.import_module("tax.migrations.0011_remove_fiscal_reconciliation_beat")


@pytest.mark.django_db
def test_deletes_old_task_rows_and_keeps_others():
    every = IntervalSchedule.objects.create(every=10, period=IntervalSchedule.MINUTES)
    PeriodicTask.objects.create(
        name="run_fiscal_reconciliation_10min", task=migration.OLD_TASK, interval=every
    )
    kept = PeriodicTask.objects.create(
        name="run_fiscal_match_10min", task="tax.tasks.run_fiscal_match", interval=every
    )

    migration.remove_old_beat_entries(apps, None)

    assert list(PeriodicTask.objects.values_list("id", flat=True)) == [kept.id]
