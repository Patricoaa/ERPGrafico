"""Cada entrada de CELERY_BEAT_SCHEDULE debe apuntar a una tarea registrada.

Si el nombre del schedule difiere del `name=` del decorador, Beat envía la
tarea pero el worker la descarta como "unregistered" y nunca se ejecuta.
"""

from django.conf import settings

from config.celery import app as celery_app


def test_beat_schedule_tasks_are_registered():
    celery_app.loader.import_default_modules()
    registered = set(celery_app.tasks)
    missing = {
        key: entry["task"]
        for key, entry in settings.CELERY_BEAT_SCHEDULE.items()
        if entry["task"] not in registered
    }
    assert not missing, f"Entradas de Beat sin tarea registrada: {missing}"
