"""Tareas Celery transversales del proyecto."""

import logging
import os
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(name="core.tasks.ping_healthcheck")
def ping_healthcheck():
    """
    Envía un ping de vida a Healthchecks.io (o compatible).
    No-op si HEALTHCHECK_PING_URL no está definido.
    Ver docs/50-audit/observability/strategy.md.
    """
    url = os.environ.get("HEALTHCHECK_PING_URL", "").strip()
    if not url:
        return "disabled"

    import requests

    try:
        requests.get(url, timeout=5)
        return "ok"
    except requests.RequestException as exc:
        logger.warning("Healthcheck ping failed: %s", exc)
        return f"error: {exc}"


@shared_task(name="core.tasks.purge_idempotency_records")
def purge_idempotency_records(retention_hours: int = 24) -> int:
    """
    Borra registros de IdempotencyRecord más viejos que `retention_hours`.

    Pensada para correr a diario via Celery beat. Ver docs/20-contracts/idempotency.md
    — la ventana de validez de un Idempotency-Key es 24h por contrato.

    Returns: número de registros eliminados (para logging).
    """
    from core.models import IdempotencyRecord

    cutoff = timezone.now() - timedelta(hours=retention_hours)
    deleted, _ = IdempotencyRecord.objects.filter(created_at__lt=cutoff).delete()
    if deleted:
        logger.info(
            "purge_idempotency_records: borrados %d registros (>%dh)", deleted, retention_hours
        )
    return deleted


def start_job(job_id: int):
    """Marca un BackgroundJob como en proceso."""
    from core.models import BackgroundJob
    BackgroundJob.objects.filter(id=job_id, status=BackgroundJob.Status.PENDING).update(
        status=BackgroundJob.Status.PROCESSING
    )


def update_job_progress(job_id: int, percent: int):
    """Actualiza el porcentaje de progreso."""
    from core.models import BackgroundJob
    BackgroundJob.objects.filter(id=job_id).update(progress_percent=min(100, max(0, percent)))


def finish_job_success(job_id: int, file_url: str = None):
    """Marca como completado y emite notificación."""
    from core.models import BackgroundJob
    from workflow.models import Notification

    job = BackgroundJob.objects.filter(id=job_id).first()
    if not job:
        return

    job.status = BackgroundJob.Status.COMPLETED
    job.progress_percent = 100
    job.completed_at = timezone.now()
    if file_url:
        job.result_file_url = file_url
    job.save(update_fields=["status", "progress_percent", "completed_at", "result_file_url"])

    Notification.objects.create(
        user=job.user,
        title="Proceso Completado",
        message=f"El proceso '{job.title}' finalizó exitosamente.",
        type=Notification.Type.SUCCESS,
        link=f"/settings/jobs",
    )


def finish_job_error(job_id: int, error_message: str):
    """Marca como fallido y emite notificación."""
    from core.models import BackgroundJob
    from workflow.models import Notification

    job = BackgroundJob.objects.filter(id=job_id).first()
    if not job:
        return

    job.status = BackgroundJob.Status.FAILED
    job.error_message = error_message
    job.completed_at = timezone.now()
    job.save(update_fields=["status", "error_message", "completed_at"])

    Notification.objects.create(
        user=job.user,
        title="Error en Proceso",
        message=f"El proceso '{job.title}' falló.",
        type=Notification.Type.ERROR,
        link=f"/settings/jobs",
    )
