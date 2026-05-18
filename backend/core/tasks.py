"""Tareas Celery transversales del proyecto."""
import os
import logging
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(name='core.tasks.ping_healthcheck')
def ping_healthcheck():
    """
    Envía un ping de vida a Healthchecks.io (o compatible).
    No-op si HEALTHCHECK_PING_URL no está definido.
    Ver docs/50-audit/observability/strategy.md.
    """
    url = os.environ.get('HEALTHCHECK_PING_URL', '').strip()
    if not url:
        return 'disabled'

    import requests
    try:
        requests.get(url, timeout=5)
        return 'ok'
    except requests.RequestException as exc:
        logger.warning('Healthcheck ping failed: %s', exc)
        return f'error: {exc}'
