"""Servicio de importación del Registro de Compras y Ventas (SII vía SimpleAPI).

Crea importaciones, elige la API key con cupo, ejecuta la consulta registrando
cada intento y hace upsert de los documentos por su clave natural.

Nunca se guardan la API key ni la clave SII: los mensajes de ``SimpleApiError``
ya vienen redactados, el resto de excepciones se resume por su tipo y la
respuesta cruda se limpia antes de guardarla.
"""

from __future__ import annotations

import logging
import time
from collections.abc import Callable
from dataclasses import fields
from datetime import date
from decimal import Decimal
from typing import Any

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from accounting.integrations.rcv_normalizer import (
    NormalizedDocument,
    NormalizedReport,
    RCVFormatError,
    normalize_report,
    normalize_rut,
)
from accounting.integrations.simpleapi_client import SimpleApiError, SimpleApiRcvClient
from accounting.models import (
    RCVApiKey,
    RCVDocument,
    RCVImport,
    RCVImportAttempt,
    RCVImportSummary,
    RCVSettings,
)
from accounting.selectors import rcv_key_usage
from core.crypto import CryptoError

logger = logging.getLogger(__name__)

Outcome = RCVImportAttempt.Outcome

MISSING_CONFIG_MESSAGE = "Falta configurar la importación RCV: {fields}."
CRYPTO_CONFIG_MESSAGE = "No se pudo leer la clave SII guardada. Vuelva a ingresarla."
CRYPTO_KEY_MESSAGE = "No se pudo leer la API key guardada. Vuelva a ingresarla."
NO_KEYS_MESSAGE = "No hay API keys activas configuradas."
QUOTA_MESSAGE = "Sin cupo en las API keys hasta el {date:%d-%m-%Y}."
AUTH_SII_MESSAGE = "El SII rechazó la clave del usuario {rut}."
TRANSIENT_MESSAGE = "SimpleAPI o el SII no respondieron; se reintentará en la próxima ejecución."
RATE_LIMITED_MESSAGE = "SimpleAPI limitó la frecuencia de consultas; intente nuevamente más tarde."
FORMAT_MESSAGE = "La respuesta del RCV no tiene el formato esperado: {detail}"
INTERNAL_MESSAGE = "Error interno al importar: {name}"
RUT_MISMATCH_WARNING = (
    "El RUT de la respuesta ({received}) no coincide con el configurado ({configured})."
)
DETAIL_MISMATCH_WARNING = (
    "El detalle del tipo {dte_type} no cuadra con el resumen del SII "
    "({detail_count}/{document_count} documentos)."
)
DUPLICATE_WARNING = "La respuesta trae {count} documento(s) repetido(s); se conservó el último."

RATE_LIMIT_RETRIES = 2
RATE_LIMIT_DEFAULT_WAIT = 60
# Pausa mínima entre dos consultas consecutivas a SimpleAPI.
MIN_PAUSE_SECONDS = 15

_ACTIVE_STATUSES = (RCVImport.Status.QUEUED, RCVImport.Status.RUNNING)
_DOC_FIELDS = tuple(f.name for f in fields(NormalizedDocument))
_KEY_FIELDS = ("dte_type", "folio", "counterparty_rut")
_UPDATE_FIELDS = (
    *(name for name in _DOC_FIELDS if name not in _KEY_FIELDS),
    "period",
    "last_import",
    "missing_since_import",
    "updated_at",
)

DocKey = tuple[int, int, str]


# ── Fechas ───────────────────────────────────────────────────────────────────


def month_start(d: date) -> date:
    return d.replace(day=1)


def next_month_start(d: date) -> date:
    return date(d.year + 1, 1, 1) if d.month == 12 else date(d.year, d.month + 1, 1)


# ── Creación ─────────────────────────────────────────────────────────────────


def create_imports(
    year: int, month: int, directions: list[str], trigger: str, user=None
) -> list[RCVImport]:
    """Crea una importación QUEUED por dirección (sin encolarlas)."""
    if not 1 <= month <= 12:
        raise ValidationError("El mes debe estar entre 1 y 12.")
    if not directions or any(d not in RCVImport.Direction.values for d in directions):
        raise ValidationError("Indique compras, ventas o ambas.")
    today = timezone.localdate()
    if (year, month) > (today.year, today.month):
        raise ValidationError("No se puede importar un período futuro.")
    with transaction.atomic():
        busy = set(
            RCVImport.objects.filter(
                year=year, month=month, direction__in=directions, status__in=_ACTIVE_STATUSES
            ).values_list("direction", flat=True)
        )
        if busy:
            labels = ", ".join(RCVImport.Direction(d).label.lower() for d in sorted(busy))
            raise ValidationError(
                f"Ya hay una importación en cola o en curso de {labels} para {month:02d}-{year}."
            )
        return [
            RCVImport.objects.create(
                direction=direction, year=year, month=month, trigger=trigger, triggered_by=user
            )
            for direction in dict.fromkeys(directions)
        ]


# ── API keys ─────────────────────────────────────────────────────────────────


def select_api_key(today: date, exclude: set[int] | None = None) -> RCVApiKey | None:
    """Key activa con cupo y menor uso del mes; marca ``last_used_at``.

    Transacción corta propia: el bloqueo no se mantiene durante la llamada HTTP.
    """
    with transaction.atomic():
        candidates = list(
            RCVApiKey.objects.select_for_update()
            .filter(is_active=True)
            .filter(Q(exhausted_until__isnull=True) | Q(exhausted_until__lte=today))
            .exclude(pk__in=exclude or ())
            .order_by("id")
        )
        if not candidates:
            return None
        usage = rcv_key_usage(month_start(today))
        eligible = [k for k in candidates if usage.get(k.id, 0) < k.monthly_limit]
        if not eligible:
            return None
        key = min(eligible, key=lambda k: (usage.get(k.id, 0), k.id))
        key.last_used_at = timezone.now()
        key.save(update_fields=["last_used_at", "updated_at"])
        return key


# ── Ejecución ────────────────────────────────────────────────────────────────


class _Failed(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(code)
        self.code = code
        self.message = message


def _finish(rcv_import: RCVImport, status: str, code: str = "", message: str = "") -> RCVImport:
    rcv_import.status = status
    rcv_import.error_code = code
    rcv_import.error_message = message
    rcv_import.finished_at = timezone.now()
    rcv_import.save()
    return rcv_import


def _credentials() -> tuple[str, str, str]:
    settings = RCVSettings.get_settings()
    company_rut = normalize_rut(settings.company_rut)
    user_rut = normalize_rut(settings.user_rut)
    try:
        password = settings.get_sii_password()
    except CryptoError:
        raise _Failed("CONFIG", CRYPTO_CONFIG_MESSAGE) from None
    missing = [
        label
        for label, value in (
            ("RUT de la empresa", company_rut),
            ("RUT del usuario SII", user_rut),
            ("clave SII", password),
        )
        if not value
    ]
    if missing:
        raise _Failed("CONFIG", MISSING_CONFIG_MESSAGE.format(fields=", ".join(missing)))
    return company_rut, user_rut, password


def _record_attempt(
    rcv_import: RCVImport,
    key: RCVApiKey,
    outcome: str,
    http_status: int,
    duration_ms: int,
    rate_limit_remaining: int | None,
    error_message: str = "",
) -> None:
    RCVImportAttempt.objects.create(
        rcv_import=rcv_import,
        api_key=key,
        outcome=outcome,
        http_status=http_status,
        duration_ms=duration_ms,
        rate_limit_remaining=rate_limit_remaining,
        error_message=error_message,
    )
    key.last_used_at = timezone.now()
    key.last_error = error_message
    key.save(update_fields=["last_used_at", "last_error", "updated_at"])


def _rate_limit_wait(err: SimpleApiError) -> float:
    if err.rate_limit_reset is None:
        return RATE_LIMIT_DEFAULT_WAIT
    seconds = (err.rate_limit_reset - timezone.now()).total_seconds()
    return max(min(seconds, RATE_LIMIT_DEFAULT_WAIT), MIN_PAUSE_SECONDS)


def _redact(value: Any, secrets: tuple[str, ...]) -> Any:
    if isinstance(value, str):
        for secret in secrets:
            value = value.replace(secret, "***")
        return value
    if isinstance(value, dict):
        return {k: _redact(v, secrets) for k, v in value.items()}
    if isinstance(value, list):
        return [_redact(v, secrets) for v in value]
    return value


def execute_import(
    rcv_import: RCVImport,
    client_factory: Callable[[str], SimpleApiRcvClient] = SimpleApiRcvClient,
    sleep: Callable[[float], None] = time.sleep,
) -> RCVImport:
    """Ejecuta la importación: rota keys sin cupo, reintenta rate limit, aplica el reporte."""
    rcv_import.status = RCVImport.Status.RUNNING
    rcv_import.started_at = timezone.now()
    rcv_import.finished_at = None
    rcv_import.error_code = ""
    rcv_import.error_message = ""
    rcv_import.warnings = []
    rcv_import.save()
    try:
        _execute(rcv_import, client_factory, sleep)
    except _Failed as failure:
        return _finish(rcv_import, RCVImport.Status.FAILED, failure.code, failure.message)
    except Exception as exc:
        logger.exception("Importación RCV %s falló inesperadamente", rcv_import.pk)
        _finish(
            rcv_import,
            RCVImport.Status.FAILED,
            "INTERNAL",
            INTERNAL_MESSAGE.format(name=type(exc).__name__),
        )
        raise
    return _finish(rcv_import, RCVImport.Status.SUCCESS)


def _execute(
    rcv_import: RCVImport,
    client_factory: Callable[[str], SimpleApiRcvClient],
    sleep: Callable[[float], None],
) -> None:
    company_rut, user_rut, password = _credentials()
    today = timezone.localdate()
    excluded: set[int] = set()
    calls = 0
    while True:
        key = select_api_key(today, exclude=excluded)
        if key is None:
            has_active = RCVApiKey.objects.filter(is_active=True).exists()
            message = (
                QUOTA_MESSAGE.format(date=next_month_start(today))
                if has_active
                else NO_KEYS_MESSAGE
            )
            raise _Failed("NO_QUOTA", message)
        try:
            plain_key = key.get_key()
        except CryptoError:
            key.last_error = CRYPTO_KEY_MESSAGE
            key.save(update_fields=["last_error", "updated_at"])
            excluded.add(key.id)
            continue
        rcv_import.api_key = key
        rcv_import.save(update_fields=["api_key", "updated_at"])
        client = client_factory(plain_key)
        retries = 0
        while True:
            if calls:
                sleep(MIN_PAUSE_SECONDS)
            calls += 1
            try:
                response = client.fetch(
                    rcv_import.direction,
                    rcv_import.year,
                    rcv_import.month,
                    company_rut,
                    user_rut,
                    password,
                )
            except SimpleApiError as err:
                message = _redact(str(err), (plain_key, password))
                _record_attempt(
                    rcv_import,
                    key,
                    err.outcome,
                    err.http_status,
                    err.duration_ms,
                    err.rate_limit_remaining,
                    message,
                )
                if err.outcome in (Outcome.QUOTA_EXHAUSTED, Outcome.AUTH_KEY):
                    key.exhausted_until = next_month_start(today)
                    key.save(update_fields=["exhausted_until", "updated_at"])
                    excluded.add(key.id)
                    break  # siguiente key
                if err.outcome == Outcome.RATE_LIMITED:
                    if retries >= RATE_LIMIT_RETRIES:
                        raise _Failed("RATE_LIMITED", RATE_LIMITED_MESSAGE) from None
                    retries += 1
                    sleep(_rate_limit_wait(err))
                    calls = 0  # la espera ya cubre la pausa mínima
                    continue
                if err.outcome == Outcome.AUTH_SII:
                    raise _Failed("AUTH_SII", AUTH_SII_MESSAGE.format(rut=user_rut)) from None
                if err.outcome == Outcome.TRANSIENT:
                    raise _Failed("TRANSIENT", TRANSIENT_MESSAGE) from None
                raise _Failed(err.outcome, message) from None
            _record_attempt(
                rcv_import,
                key,
                Outcome.OK,
                response.http_status,
                response.duration_ms,
                response.rate_limit_remaining,
            )
            rcv_import.raw_response = _redact(response.body, (plain_key, password))
            rcv_import.save(update_fields=["raw_response", "updated_at"])
            try:
                report = normalize_report(rcv_import.direction, response.body)
                apply_report(rcv_import, report)
            except RCVFormatError as exc:
                detail = _redact(str(exc), (plain_key, password))
                raise _Failed("FORMAT", FORMAT_MESSAGE.format(detail=detail)) from None
            return


# ── Aplicación del reporte ───────────────────────────────────────────────────


def _doc_key(doc: NormalizedDocument | RCVDocument) -> DocKey:
    return (doc.dte_type, doc.folio, doc.counterparty_rut)


def _warn(warnings: list[str], message: str) -> None:
    if message not in warnings:
        warnings.append(message)


def _save_summaries(
    rcv_import: RCVImport,
    report: NormalizedReport,
    documents: dict[DocKey, NormalizedDocument],
    warnings: list[str],
) -> bool:
    """Recrea los resúmenes; devuelve ``True`` si todo tipo con detalle cuadra."""
    detail: dict[int, tuple[int, Decimal]] = {}
    for doc in documents.values():
        count, total = detail.get(doc.dte_type, (0, Decimal("0")))
        detail[doc.dte_type] = (count + 1, total + doc.total_amount)
    complete = True
    rows = []
    for summary in report.summaries:
        count, total = detail.get(summary.dte_type, (0, Decimal("0")))
        if count and (count != summary.document_count or total != summary.total_amount):
            complete = False
            _warn(
                warnings,
                DETAIL_MISMATCH_WARNING.format(
                    dte_type=summary.dte_type,
                    detail_count=count,
                    document_count=summary.document_count,
                ),
            )
        rows.append(
            RCVImportSummary(
                rcv_import=rcv_import,
                has_detail=count > 0,
                detail_count=count,
                detail_total=total,
                **{f.name: getattr(summary, f.name) for f in fields(summary)},
            )
        )
    RCVImportSummary.objects.filter(rcv_import=rcv_import).delete()
    RCVImportSummary.objects.bulk_create(rows)
    return complete


@transaction.atomic
def apply_report(rcv_import: RCVImport, report: NormalizedReport) -> None:
    """Guarda resúmenes, hace upsert de documentos y marca los ausentes."""
    company_rut = normalize_rut(RCVSettings.get_settings().company_rut)
    direction = rcv_import.direction
    period = report.period
    warnings = list(rcv_import.warnings)
    if report.company_rut and report.company_rut != company_rut:
        _warn(
            warnings,
            RUT_MISMATCH_WARNING.format(received=report.company_rut, configured=company_rut),
        )

    documents: dict[DocKey, NormalizedDocument] = {}
    for doc in report.documents:
        documents[_doc_key(doc)] = doc
    if len(documents) < len(report.documents):
        _warn(warnings, DUPLICATE_WARNING.format(count=len(report.documents) - len(documents)))

    complete = _save_summaries(rcv_import, report, documents, warnings)

    folios = {key[1] for key in documents}
    existing = {
        _doc_key(doc): doc
        for doc in RCVDocument.objects.filter(company_rut=company_rut, direction=direction).filter(
            Q(period=period) | Q(folio__in=folios)
        )
    }
    absent = [d for k, d in existing.items() if d.period == period and k not in documents]

    now = timezone.now()
    to_create: list[RCVDocument] = []
    to_update: list[RCVDocument] = []
    for key, doc in documents.items():
        values = {name: getattr(doc, name) for name in _DOC_FIELDS}
        current = existing.get(key)
        if current is None:
            to_create.append(
                RCVDocument(
                    direction=direction,
                    company_rut=company_rut,
                    period=period,
                    first_import=rcv_import,
                    last_import=rcv_import,
                    **values,
                )
            )
            continue
        for name, value in values.items():
            setattr(current, name, value)
        current.period = period
        current.last_import = rcv_import
        current.missing_since_import = None
        current.updated_at = now
        to_update.append(current)
    RCVDocument.objects.bulk_create(to_create)
    if to_update:
        RCVDocument.objects.bulk_update(to_update, _UPDATE_FIELDS)

    missing_count = 0
    if complete:
        missing_count = len(absent)
        newly_missing = [d.pk for d in absent if d.missing_since_import_id is None]
        if newly_missing:
            RCVDocument.objects.filter(pk__in=newly_missing).update(
                missing_since_import=rcv_import, updated_at=now
            )

    rcv_import.warnings = warnings
    rcv_import.received_count = len(documents)
    rcv_import.created_count = len(to_create)
    rcv_import.updated_count = len(to_update)
    rcv_import.missing_count = missing_count
    rcv_import.save(
        update_fields=[
            "warnings",
            "received_count",
            "created_count",
            "updated_count",
            "missing_count",
            "updated_at",
        ]
    )
