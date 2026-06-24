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
