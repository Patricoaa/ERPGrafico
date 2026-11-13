"""Servicio de sincronización de ventas de terminal (TUU).

Crea ejecuciones, consulta a TUU por tramos de hasta 30 días, conserva las
respuestas crudas y hace upsert de las ventas unificadas.
"""

from __future__ import annotations

import logging
from datetime import date, timedelta

from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils import timezone

from treasury.integrations.tuu_client import (
    TuuAuthError,
    TuuClient,
    TuuError,
    TuuPage,
    TuuPlanError,
    TuuTransientError,
)
from treasury.integrations.tuu_normalizer import NormalizedSale, build_sales_report
from treasury.models import (
    PaymentTerminalDevice,
    PaymentTerminalProvider,
    TerminalSale,
    TerminalSyncPayload,
    TerminalSyncRun,
    TerminalSyncSettings,
)

logger = logging.getLogger(__name__)

MAX_CHUNK_DAYS = 30
AUTH_MESSAGE = "La API key de TUU fue rechazada. Revise la key del proveedor."
PLAN_MESSAGE = (
    "La cuenta TUU no tiene habilitado el reporte (plan PaaS requerido o servicio deshabilitado)."
)
TRANSIENT_MESSAGE = "TUU no respondió correctamente; se reintentará automáticamente."

_SALE_FIELDS = (
    "sale_id",
    "sequence_number",
    "location_id",
    "transaction_at",
    "status",
    "raw_status",
    "payment_type",
    "document_type",
    "instance",
    "card_brand",
    "card_bin",
    "card_issuer",
    "card_origin",
    "installment_type",
    "installment_count",
    "acquirer_id",
    "currency",
    "sale_amount",
    "tip_amount",
    "cashback_amount",
    "total_amount",
    "commission_amount",
    "net_amount",
    "settlement_date",
    "settlement_id",
    "settlement_amount",
    "reconciliations",
    "items",
    "raw",
    "sources",
)


# ── Rangos ───────────────────────────────────────────────────────────────────


def split_range(start: date, end: date, max_days: int = MAX_CHUNK_DAYS) -> list[tuple[date, date]]:
    """Tramos inclusivos y consecutivos de hasta ``max_days`` días."""
    chunks: list[tuple[date, date]] = []
    cursor = start
    while cursor <= end:
        chunk_end = min(cursor + timedelta(days=max_days - 1), end)
        chunks.append((cursor, chunk_end))
        cursor = chunk_end + timedelta(days=1)
    return chunks


def eligible_providers() -> models.QuerySet[PaymentTerminalProvider]:
    return PaymentTerminalProvider.objects.filter(
        provider_type=PaymentTerminalProvider.ProviderType.TUU,
        is_active=True,
        gateway_config__has_key="api_key_encrypted",
    )


def daily_range(settings: TerminalSyncSettings, today: date) -> tuple[date, date] | None:
    start = today - timedelta(days=settings.lookback_days)
    if settings.history_start_date:
        start = max(settings.history_start_date, start)
    end = today - timedelta(days=1)
    return None if start > end else (start, end)


def manual_range(
    settings: TerminalSyncSettings, today: date, start: date | None, end: date | None
) -> tuple[date, date]:
    start = start or settings.history_start_date or today - timedelta(days=settings.lookback_days)
    end = end or today
    if start > end:
        raise ValidationError("La fecha inicial no puede ser posterior a la final.")
    if end > today:
        raise ValidationError("La fecha final no puede ser futura.")
    return start, end


# ── Ejecución ────────────────────────────────────────────────────────────────


def create_run(
    provider: PaymentTerminalProvider, start: date, end: date, trigger: str, user=None
) -> TerminalSyncRun:
    return TerminalSyncRun.objects.create(
        provider=provider,
        trigger=trigger,
        status=TerminalSyncRun.Status.RUNNING,
        start_date=start,
        end_date=end,
        started_at=timezone.now(),
        triggered_by=user,
    )


def _save_payloads(run: TerminalSyncRun, pages: list[TuuPage], start: date, end: date) -> None:
    TerminalSyncPayload.objects.bulk_create(
        [
            TerminalSyncPayload(
                run=run,
                report=page.report,
                chunk_start=start,
                chunk_end=end,
                page=page.page,
                http_status=page.http_status,
                request_body=page.request_body,
                response_body=page.response_body,
            )
            for page in pages
        ]
    )


def _fetch_chunk(
    run: TerminalSyncRun, client: TuuClient, start: date, end: date
) -> tuple[list[dict], list[dict], list[dict]]:
    """Trae A, B y C del tramo guardando los crudos de cada llamada recibida."""
    results: list[list[dict]] = []
    for fetch in (
        lambda: client.fetch_branch(start, end, cash=False),
        lambda: client.fetch_branch(start, end, cash=True),
        lambda: client.fetch_general(start, end),
    ):
        pages = fetch()
        _save_payloads(run, pages, start, end)
        results.append([row for page in pages for row in page.rows])
    return results[0], results[1], results[2]


def _coerce(field_name: str, value):
    field = TerminalSale._meta.get_field(field_name)
    return "" if value is None and not field.null else value


def _sale_values(sale: NormalizedSale) -> dict:
    return {name: _coerce(name, getattr(sale, name)) for name in _SALE_FIELDS}


def _upsert_chunk(
    run: TerminalSyncRun,
    sales: list[NormalizedSale],
    devices: dict[str, PaymentTerminalDevice],
) -> tuple[int, int]:
    existing = {
        s.natural_key: s
        for s in TerminalSale.objects.filter(
            provider=run.provider, natural_key__in=[s.natural_key for s in sales]
        )
    }
    to_create: list[TerminalSale] = []
    to_update: list[TerminalSale] = []
    for sale in sales:
        values = _sale_values(sale)
        current = existing.get(sale.natural_key)
        if current is None:
            to_create.append(
                TerminalSale(
                    provider=run.provider,
                    natural_key=sale.natural_key,
                    serial_number=sale.serial_number,
                    device=devices.get(sale.serial_number),
                    first_seen_run=run,
                    last_seen_run=run,
                    **values,
                )
            )
            continue
        if current.serial_number != sale.serial_number:
            _warn(
                run,
                f"Venta {sale.natural_key}: el N° de serie cambió "
                f"({current.serial_number or '-'} -> {sale.serial_number or '-'}); se conserva el guardado.",
            )
        changed = [n for n, v in values.items() if getattr(current, n) != v]
        for name in changed:
            setattr(current, name, values[name])
        current.last_seen_run = run
        if changed:
            to_update.append(current)
        else:
            TerminalSale.objects.filter(pk=current.pk).update(last_seen_run=run)
    TerminalSale.objects.bulk_create(to_create)
    if to_update:
        TerminalSale.objects.bulk_update(to_update, [*_SALE_FIELDS, "last_seen_run"])
    return len(to_create), len(to_update)


def _warn(run: TerminalSyncRun, message: str) -> None:
    if message not in run.warnings:
        run.warnings.append(message)


def _finish(run: TerminalSyncRun, status: str, error: str = "") -> TerminalSyncRun:
    run.status = status
    run.error_message = error
    run.finished_at = timezone.now()
    run.save()
    return run


def execute_run(run: TerminalSyncRun, client: TuuClient | None = None) -> TerminalSyncRun:
    """Ejecuta la sincronización del rango de ``run``.

    ``TuuTransientError`` se relanza tras guardar el progreso para que la tarea
    decida reintentar; credenciales/plan inválidos dejan la ejecución FAILED.
    """
    if client is None:
        client = TuuClient(run.provider.get_api_key())
    run.attempts += 1
    run.save(update_fields=["attempts", "updated_at"])
    devices = {
        d.serial_number: d for d in PaymentTerminalDevice.objects.filter(provider=run.provider)
    }
    ok_chunks = 0
    failures: list[str] = []
    for start, end in split_range(run.start_date, run.end_date):
        try:
            card, cash, general = _fetch_chunk(run, client, start, end)
        except TuuTransientError:
            run.error_message = TRANSIENT_MESSAGE
            run.save()
            raise
        except TuuAuthError:
            return _finish(run, TerminalSyncRun.Status.FAILED, AUTH_MESSAGE)
        except TuuPlanError:
            return _finish(run, TerminalSyncRun.Status.FAILED, PLAN_MESSAGE)
        except TuuError as exc:
            failures.append(f"Tramo {start}..{end}: {exc}")
            logger.warning("Tramo TUU fallido run=%s %s..%s", run.pk, start, end)
            continue
        sales, warnings = build_sales_report(card, cash, general)
        for warning in warnings:
            _warn(run, warning)
        with transaction.atomic():
            created, updated = _upsert_chunk(run, sales, devices)
        run.fetched_count += len(sales)
        run.created_count += created
        run.updated_count += updated
        ok_chunks += 1
        run.save()
    if failures:
        status = TerminalSyncRun.Status.PARTIAL if ok_chunks else TerminalSyncRun.Status.FAILED
        return _finish(run, status, " | ".join(failures))
    status = TerminalSyncRun.Status.PARTIAL if run.warnings else TerminalSyncRun.Status.SUCCESS
    return _finish(run, status)
