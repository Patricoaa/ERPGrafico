"""Tareas periódicas del módulo fiscal (ADR-0140 D4)."""

import calendar
import logging
import uuid
from datetime import date

from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded
from django.core.cache import cache
from django.utils import timezone

from accounting.models import RCVSettings

from .reconciliation.boletas import reconcile_rcv_boletas
from .reconciliation.issuing import issue_fiscal_drafts
from .reconciliation.terminal import reconcile_terminal_sales

logger = logging.getLogger(__name__)

LOCK_KEY = "tax:fiscal_reconciliation:lock"
LOCK_TIMEOUT = 540  # 9 min: menos que el período de 10 min de la tarea
SOFT_TIME_LIMIT = 520  # corta la ejecución antes de que expire el candado
PREVIOUS_MONTH_UNTIL_DAY = 10


def _local_today() -> date:
    return timezone.localdate()


def months_to_reconcile(today: date) -> list[tuple[int, int]]:
    """Mes actual y, durante los primeros 10 días, también el anterior."""
    months = [(today.year, today.month)]
    if today.day <= PREVIOUS_MONTH_UNTIL_DAY:
        months.append((today.year, today.month - 1) if today.month > 1 else (today.year - 1, 12))
    return months


def _step(name: str, label: str, fn, *args) -> dict:
    try:
        return fn(*args)
    except SoftTimeLimitExceeded:
        raise  # el límite corta toda la cadena, no solo el paso
    except Exception as exc:
        logger.exception("Cuadre fiscal %s: falló el paso %s", label, name)
        return {"error": type(exc).__name__}


def _reconcile_month(year: int, month: int) -> dict:
    label = f"{year}-{month:02d}"
    last = calendar.monthrange(year, month)[1]
    terminal = _step("terminal", label, reconcile_terminal_sales, date(year, month, 1), date(year, month, last))
    _step("boletas", label, reconcile_rcv_boletas, year, month)
    issued = _step("issue", label, issue_fiscal_drafts, year, month)
    boletas = _step("boletas", label, reconcile_rcv_boletas, year, month)
    return {"terminal": terminal, "boletas": boletas, "issued": issued}


@shared_task(name="tax.tasks.run_fiscal_reconciliation", soft_time_limit=SOFT_TIME_LIMIT)
def run_fiscal_reconciliation() -> dict:
    """Cadena local: terminal → boletas → emisión de borradores → boletas."""
    token = uuid.uuid4().hex
    if not cache.add(LOCK_KEY, token, timeout=LOCK_TIMEOUT):
        return {"skipped": True}
    try:
        if RCVSettings.get_settings().fiscal_match_start_date is None:
            return {"skipped": True}
        months = {
            f"{y}-{m:02d}": _reconcile_month(y, m) for y, m in months_to_reconcile(_local_today())
        }
        return {"months": months}
    finally:
        # Solo libera su propio candado: si expiró, otra ejecución puede tenerlo.
        if cache.get(LOCK_KEY) == token:
            cache.delete(LOCK_KEY)
