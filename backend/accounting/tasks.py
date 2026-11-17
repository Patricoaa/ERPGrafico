"""Tareas Celery de la importación RCV (SII vía SimpleAPI)."""

from __future__ import annotations

import logging
import time

from celery import shared_task
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from accounting import rcv_service
from accounting.models import RCVImport, RCVSettings

logger = logging.getLogger(__name__)


def _now():
    """Hora local actual; punto único para poder fijarla en tests."""
    return timezone.localtime()


@shared_task(name="accounting.tasks.dispatch_rcv_imports")
def dispatch_rcv_imports() -> int:
    """Crea y encola las importaciones automáticas si corresponde; retorna cuántas."""
    rcv_service.recover_stale_imports()
    config = RCVSettings.get_settings()
    now = _now()
    last = (
        RCVImport.objects.filter(trigger=RCVImport.Trigger.SCHEDULED)
        .order_by("-created_at")
        .values_list("created_at", flat=True)
        .first()
    )
    last_date = timezone.localtime(last).date() if last else None
    if not rcv_service.is_scheduled_run_due(config, now, last_date):
        return 0
    directions = []
    if config.include_purchases:
        directions.append(RCVImport.Direction.PURCHASES)
    if config.include_sales:
        directions.append(RCVImport.Direction.SALES)
    created: list[RCVImport] = []
    for year, month, direction in rcv_service.scheduled_targets(now.date(), directions):
        try:
            created.extend(
                rcv_service.create_imports(year, month, [direction], RCVImport.Trigger.SCHEDULED)
            )
        except ValidationError:
            continue  # ya hay una en cola o en curso para ese período
    rcv_service.enqueue_imports(created, run_rcv_imports.delay)
    return len(created)


@shared_task(name="accounting.tasks.run_rcv_imports")
def run_rcv_imports(import_ids: list[int]) -> list[str]:
    """Ejecuta las importaciones en orden, con pausa entre consultas consecutivas."""
    statuses: list[str] = []
    for index, import_id in enumerate(import_ids):
        if index:
            time.sleep(rcv_service.MIN_PAUSE_SECONDS)
        try:
            rcv_import = RCVImport.objects.get(pk=import_id)
            executed = rcv_service.execute_import(rcv_import)
            statuses.append(executed.status)
        except Exception as exc:
            # Solo el tipo: el mensaje podría contener secretos.
            logger.error("Importación RCV %s abortada: %s", import_id, type(exc).__name__)
            status = RCVImport.objects.filter(pk=import_id).values_list("status", flat=True).first()
            statuses.append(status or RCVImport.Status.FAILED)
            continue
        if executed.status == RCVImport.Status.SUCCESS:
            _reconcile_imported_period(executed)
    return statuses


def _reconcile_imported_period(rcv_import: RCVImport) -> None:
    """Encola el motor de cuadre al confirmar; un fallo nunca tumba la importación."""
    from tax.tasks import run_fiscal_match

    def enqueue() -> None:
        try:
            run_fiscal_match.delay()
        except Exception:
            logger.exception("No se pudo encolar el cuadre tras la importación RCV %s", rcv_import.pk)

    transaction.on_commit(enqueue)
