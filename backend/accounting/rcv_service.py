"""Servicio de importación del Registro de Compras y Ventas (SII vía SimpleAPI).

Crea importaciones, elige la API key con cupo, ejecuta la consulta registrando
cada intento y hace upsert de los documentos por su clave natural.

Nunca se guardan la API key ni la clave SII: los mensajes de ``SimpleApiError``
ya vienen redactados, el resto de excepciones se resume por su tipo y la
respuesta cruda se limpia antes de guardarla.
"""

from __future__ import annotations

import logging
import math
import time
from collections.abc import Callable
from dataclasses import fields
from datetime import date, datetime, timedelta
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
from accounting.integrations.simpleapi_client import (
    SimpleApiError,
    SimpleApiRcvClient,
    redact_secrets,
)
from accounting.models import (
    RCVApiKey,
    RCVDocument,
    RCVImport,
    RCVImportAttempt,
    RCVImportSummary,
    RCVSettings,
)
from accounting.rcv_contacts import ensure_contacts_for_documents
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
NO_SUMMARY_WARNING = "El tipo {dte_type} no viene en el resumen del SII; no se marcaron faltantes."
PERIOD_MISMATCH_WARNING = (
    "El período de la respuesta ({received}) no coincide con el solicitado ({requested})."
)
INTERRUPTED_MESSAGE = "La importación se interrumpió y se marcó como fallida."

RATE_LIMIT_RETRIES = 2
RATE_LIMIT_DEFAULT_WAIT = 60
# Pausa mínima entre dos consultas consecutivas a SimpleAPI.
MIN_PAUSE_SECONDS = 15
# Una importación activa más antigua que esto quedó huérfana (p. ej. reinicio del worker).
STALE_IMPORT_MINUTES = 30

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


def recover_stale_imports() -> int:
    """Marca FAILED las importaciones activas que nunca terminaron; retorna cuántas.

    QUEUED se mide desde ``created_at`` y RUNNING desde ``started_at``.
    """
    now = timezone.now()
    cutoff = now - timedelta(minutes=STALE_IMPORT_MINUTES)
    stale = Q(status=RCVImport.Status.QUEUED, created_at__lt=cutoff) | Q(
        status=RCVImport.Status.RUNNING, started_at__lt=cutoff
    )
    count = RCVImport.objects.filter(stale).update(
        status=RCVImport.Status.FAILED,
        error_code="INTERRUPTED",
        error_message=INTERRUPTED_MESSAGE,
        finished_at=now,
        updated_at=now,
    )
    if count:
        logger.warning("%s importación(es) RCV interrumpidas marcadas como fallidas.", count)
    return count


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
        recover_stale_imports()
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


# ── Programación ─────────────────────────────────────────────────────────────

PERIOD_LAG_DAYS = 3


def period_for(run_date: date) -> tuple[int, int]:
    """Período automático: mes/año de ``run_date`` menos 3 días."""
    ref = run_date - timedelta(days=PERIOD_LAG_DAYS)
    return ref.year, ref.month


def is_scheduled_run_due(
    settings: RCVSettings, now_local: datetime, last_scheduled: date | None
) -> bool:
    """Corresponde correr: habilitado, pasada la hora y cumplido el intervalo."""
    if not settings.enabled or now_local.hour < settings.run_hour:
        return False
    if last_scheduled is None:
        return True
    return (now_local.date() - last_scheduled).days >= settings.interval_days


def scheduled_targets(today: date, directions: list[str]) -> list[tuple[int, int, str]]:
    """Período vigente por dirección, más el mes anterior si aún no se cerró.

    El mes anterior se da por cerrado cuando hay una importación SUCCESS (de
    cualquier origen) iniciada a partir del primer día del mes siguiente.
    """
    year, month = period_for(today)
    prev = date(year - 1, 12, 1) if month == 1 else date(year, month - 1, 1)
    closed_from = timezone.make_aware(datetime.combine(next_month_start(prev), datetime.min.time()))
    closed = set(
        RCVImport.objects.filter(
            year=prev.year,
            month=prev.month,
            direction__in=directions,
            status=RCVImport.Status.SUCCESS,
            started_at__gte=closed_from,
        ).values_list("direction", flat=True)
    )
    targets = [(prev.year, prev.month, d) for d in directions if d not in closed]
    targets.extend((year, month, d) for d in directions)
    return targets


def estimated_monthly_queries(settings: RCVSettings) -> int:
    """Consultas/mes estimadas: ``ceil(30 / intervalo) * n + n`` con n = direcciones activas."""
    n = int(settings.include_purchases) + int(settings.include_sales)
    interval = max(settings.interval_days, 1)
    return math.ceil(30 / interval) * n + n


def enqueue_imports(imports: list[RCVImport], delay: Callable[[list[int]], Any]) -> None:
    """Encola todas las importaciones en una sola tarea al confirmar la transacción.

    Si se encolara antes del commit, el worker podría no ver las filas QUEUED y
    omitirlas. Si el broker falla, se marcan FAILED.
    """
    if not imports:
        return
    ids = [i.id for i in imports]
    transaction.on_commit(lambda: _send(ids, delay))


def _send(ids: list[int], delay: Callable[[list[int]], Any]) -> None:
    try:
        delay(ids)
    except Exception as exc:
        logger.error("No se pudo encolar la importación RCV: %s", type(exc).__name__)
        now = timezone.now()
        RCVImport.objects.filter(pk__in=ids).update(
            status=RCVImport.Status.FAILED,
            error_code="ENQUEUE",
            error_message="No se pudo encolar la importación.",
            finished_at=now,
            updated_at=now,
        )


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
        return redact_secrets(value, secrets)
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
    started_at = timezone.now()
    claimed = RCVImport.objects.filter(pk=rcv_import.pk, status=RCVImport.Status.QUEUED).update(
        status=RCVImport.Status.RUNNING, started_at=started_at, updated_at=started_at
    )
    if not claimed:
        # Ya tomada o terminada (p. ej. tarea Celery reentregada): no gastar cupo otra vez.
        logger.info("Importación RCV %s no está en cola; se omite.", rcv_import.pk)
        rcv_import.refresh_from_db()
        return rcv_import
    rcv_import.refresh_from_db()
    try:
        _execute(rcv_import, client_factory, sleep)
    except _Failed as failure:
        return _finish(rcv_import, RCVImport.Status.FAILED, failure.code, failure.message)
    except Exception as exc:
        # Solo el tipo: el mensaje o el traceback podrían contener secretos.
        logger.error(
            "Importación RCV %s falló inesperadamente: %s", rcv_import.pk, type(exc).__name__
        )
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
            # Los contactos se derivan del reporte, fuera del upsert: así el
            # número de queries de ``apply_report`` no crece con los documentos.
            customers = ensure_contacts_for_documents(report.documents, company_rut)
            rcv_import.contacts_created_count = customers.created
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
    stored_types: set[int],
    warnings: list[str],
) -> bool:
    """Recrea los resúmenes; devuelve ``True`` si todo tipo con detalle cuadra.

    Un tipo sin filas en el detalle pero con documentos ya guardados del período
    también cuenta como descuadre (detalle truncado), no como "solo resumen". Un
    tipo con detalle o documentos guardados que no viene en el resumen (resumen
    vacío o parcial) deja la importación incompleta.
    """
    detail: dict[int, tuple[int, Decimal]] = {}
    for doc in documents.values():
        count, total = detail.get(doc.dte_type, (0, Decimal("0")))
        detail[doc.dte_type] = (count + 1, total + doc.total_amount)
    complete = True
    summary_types = {summary.dte_type for summary in report.summaries}
    # Un tipo sin fila de resumen (con detalle o con documentos guardados) no
    # permite saber si el detalle está completo: no se marcan faltantes.
    for dte_type in sorted((stored_types | detail.keys()) - summary_types):
        complete = False
        _warn(warnings, NO_SUMMARY_WARNING.format(dte_type=dte_type))
    rows = []
    for summary in report.summaries:
        count, total = detail.get(summary.dte_type, (0, Decimal("0")))
        mismatch = (
            count != summary.document_count or total != summary.total_amount
            if count
            else summary.document_count > 0 and summary.dte_type in stored_types
        )
        if mismatch:
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
    warnings: list[str] = []
    requested = f"{rcv_import.year}{rcv_import.month:02d}"
    if period != requested:
        _warn(warnings, PERIOD_MISMATCH_WARNING.format(received=period, requested=requested))
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

    folios = {key[1] for key in documents}
    existing = {
        _doc_key(doc): doc
        for doc in RCVDocument.objects.filter(company_rut=company_rut, direction=direction).filter(
            Q(period=period) | Q(folio__in=folios)
        )
    }
    absent = [d for k, d in existing.items() if d.period == period and k not in documents]
    stored_types = {d.dte_type for d in existing.values() if d.period == period}

    complete = _save_summaries(rcv_import, report, documents, stored_types, warnings)

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
