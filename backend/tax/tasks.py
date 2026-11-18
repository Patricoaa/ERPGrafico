"""Tareas periódicas del módulo fiscal (spec cuadre unificado §5.4)."""

import logging
import uuid
from collections.abc import Iterator
from contextlib import contextmanager

from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded
from django.core.cache import cache

logger = logging.getLogger(__name__)

FISCAL_MATCH_LOCK_KEY = "tax:fiscal_match:lock"
FISCAL_MATCH_LOCK_TIMEOUT = 540  # 9 min: menos que el período de 10 min de la tarea
SOFT_TIME_LIMIT = 520  # corta la ejecución antes de que expire el candado


@contextmanager
def fiscal_match_lock(timeout: int = FISCAL_MATCH_LOCK_TIMEOUT) -> Iterator[bool]:
    """Candado en caché del cuadre, compartido por el motor y la unión manual.

    Entrega si se obtuvo. Solo libera su propio candado: si expiró, otro proceso
    puede tenerlo.
    """
    token = uuid.uuid4().hex
    acquired = cache.add(FISCAL_MATCH_LOCK_KEY, token, timeout=timeout)
    try:
        yield acquired
    finally:
        if acquired and cache.get(FISCAL_MATCH_LOCK_KEY) == token:
            cache.delete(FISCAL_MATCH_LOCK_KEY)


def _step(name: str, label: str, fn, *args) -> dict:
    try:
        return fn(*args)
    except SoftTimeLimitExceeded:
        raise  # el límite corta toda la cadena, no solo el paso
    except Exception as exc:
        logger.exception("Cuadre %s: falló el paso %s", label, name)
        return {"error": type(exc).__name__}


@shared_task(name="tax.tasks.run_fiscal_match", soft_time_limit=SOFT_TIME_LIMIT)
def run_fiscal_match() -> dict:
    """Motor único del cuadre (spec §5.4); cada 10 min y tras cada sincronización TUU / RCV."""
    from .fiscal_match import engine

    with fiscal_match_lock() as acquired:
        if not acquired:
            return {"skipped": True}
        return _step("motor", "cuadre", engine.run_fiscal_match)
