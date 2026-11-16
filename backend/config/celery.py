import os

from celery import Celery
from celery.signals import task_prerun, worker_process_init

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("erp_grafico")

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
# - namespace='CELERY' means all celery-related configuration keys
#   should have a `CELERY_` prefix.
app.config_from_object("django.conf:settings", namespace="CELERY")

# Load task modules from all registered Django apps.
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f"Request: {self.request!r}")


@task_prerun.connect
@worker_process_init.connect
def apply_debug_clock_for_task(*args, **kwargs):
    """ADR-0139 D4: aplica el reloj de depuración en el worker (no-op fuera de dev)."""
    from core import debug_clock

    if debug_clock.is_enabled() or debug_clock.is_active():
        debug_clock.apply_debug_clock()
