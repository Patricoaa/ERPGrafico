"""Normalizador de respuestas del RCV (SII vía SimpleAPI).

Funciones puras, sin ORM ni HTTP: convierten el JSON crudo en dataclasses
tipadas que el servicio de importación persiste.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any
from zoneinfo import ZoneInfo

CHILE_TZ = ZoneInfo("America/Santiago")

_SECTIONS = {
    "PURCHASES": ("compras", "detalleCompras"),
    "SALES": ("ventas", "detalleVentas"),
}


class RCVFormatError(ValueError):
    """La respuesta no tiene la forma esperada (sin carátula o sin la sección)."""


# ── RUT ──────────────────────────────────────────────────────────────────────


def normalize_rut(value: str | None) -> str:
    """Quita puntos/espacios, deja DV en mayúscula: ``8973356-1``. ``""`` si vacío."""
    if value is None:
        return ""
    cleaned = re.sub(r"[.\s]", "", str(value)).upper()
    if cleaned in ("", "-"):
        return ""
    if "-" not in cleaned and len(cleaned) > 1:
        cleaned = f"{cleaned[:-1]}-{cleaned[-1]}"
    return cleaned


def is_valid_rut(value: str) -> bool:
    """Valida el dígito verificador con módulo 11."""
    rut = normalize_rut(value)
    match = re.fullmatch(r"(\d{1,9})-([0-9K])", rut)
    if not match:
        return False
    body, dv = match.groups()
    total = 0
    factor = 2
    for digit in reversed(body):
        total += int(digit) * factor
        factor = 2 if factor == 7 else factor + 1
    remainder = 11 - total % 11
    expected = "0" if remainder == 11 else "K" if remainder == 10 else str(remainder)
    return dv == expected


# ── Conversores de valores ───────────────────────────────────────────────────


def _is_blank(value: Any) -> bool:
    return value is None or (isinstance(value, str) and value.strip() in ("", "-"))


def _text(value: Any) -> str:
    return "" if _is_blank(value) else str(value).strip()


def _amount(value: Any) -> Decimal:
    if _is_blank(value):
        return Decimal("0")
    try:
        return Decimal(str(value))
    except InvalidOperation:
        return Decimal("0")


def _int_or_none(value: Any) -> int | None:
    if _is_blank(value):
        return None
    try:
        return int(Decimal(str(value)))
    except (InvalidOperation, ValueError):
        return None


def _parse_datetime(value: Any) -> datetime | None:
    if _is_blank(value):
        return None
    try:
        parsed = datetime.fromisoformat(str(value).strip())
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=CHILE_TZ)
    return parsed


def _parse_date(value: Any) -> date:
    parsed = _parse_datetime(value)
    if parsed is None:
        raise RCVFormatError(f"Fecha de emisión inválida: {value!r}")
    return parsed.astimezone(CHILE_TZ).date()


def _required_int(record: dict[str, Any], *keys: str) -> int:
    for key in keys:
        parsed = _int_or_none(record.get(key))
        if parsed is not None:
            return parsed
    raise RCVFormatError(f"Falta el campo {' / '.join(keys)}")


# ── Dataclasses ──────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class NormalizedSummary:
    dte_type: int
    dte_type_label: str
    document_count: int
    exempt_amount: Decimal
    net_amount: Decimal
    vat_recoverable: Decimal
    vat_common_use: Decimal
    vat_non_recoverable: Decimal
    total_amount: Decimal
    status: str


@dataclass(frozen=True)
class NormalizedDocument:
    dte_type: int
    dte_type_label: str
    folio: int
    counterparty_rut: str
    counterparty_name: str
    issue_date: date
    received_at: datetime | None
    acknowledged_at: datetime | None
    operation_type: str
    status: str
    acknowledgement: str
    service_indicator: int | None
    exempt_amount: Decimal
    net_amount: Decimal
    vat_amount: Decimal
    vat_recoverable: Decimal
    vat_non_recoverable: Decimal
    total_amount: Decimal
    other_taxes_total: Decimal
    reference_dte_type: int | None
    reference_folio: str
    raw: dict[str, Any]


@dataclass(frozen=True)
class NormalizedReport:
    period: str
    company_rut: str
    summaries: list[NormalizedSummary]
    documents: list[NormalizedDocument]


# ── Normalización ────────────────────────────────────────────────────────────


def _normalize_summary(record: dict[str, Any]) -> NormalizedSummary:
    return NormalizedSummary(
        dte_type=_required_int(record, "tipoDte", "tipoDTE"),
        dte_type_label=_text(record.get("tipoDteString") or record.get("tipoDTEString")),
        document_count=_int_or_none(record.get("totalDocumentos")) or 0,
        exempt_amount=_amount(record.get("montoExento")),
        net_amount=_amount(record.get("montoNeto")),
        vat_recoverable=_amount(record.get("ivaRecuperable")),
        vat_common_use=_amount(record.get("ivaUsoComun")),
        vat_non_recoverable=_amount(record.get("ivaNoRecuperable")),
        total_amount=_amount(record.get("montoTotal")),
        status=_text(record.get("estado")),
    )


def _consolidate_summaries(summaries: list[NormalizedSummary]) -> list[NormalizedSummary]:
    """Consolida resúmenes por tipo de DTE.

    En compras, el SII desglosa el resumen del mismo tipo DTE por estado
    (p. ej. 'Confirmada' y 'Pendiente'). Para el control de completitud y
    la presentación en el ERP, se consolidan en una única fila por tipo DTE
    sumando documentos y montos.
    """
    by_type: dict[int, NormalizedSummary] = {}
    for s in summaries:
        if s.dte_type not in by_type:
            by_type[s.dte_type] = s
        else:
            prev = by_type[s.dte_type]
            status = prev.status if prev.status == s.status else ""
            by_type[s.dte_type] = NormalizedSummary(
                dte_type=s.dte_type,
                dte_type_label=prev.dte_type_label or s.dte_type_label,
                document_count=prev.document_count + s.document_count,
                exempt_amount=prev.exempt_amount + s.exempt_amount,
                net_amount=prev.net_amount + s.net_amount,
                vat_recoverable=prev.vat_recoverable + s.vat_recoverable,
                vat_common_use=prev.vat_common_use + s.vat_common_use,
                vat_non_recoverable=prev.vat_non_recoverable + s.vat_non_recoverable,
                total_amount=prev.total_amount + s.total_amount,
                status=status,
            )
    return list(by_type.values())


def _normalize_document(direction: str, record: dict[str, Any]) -> NormalizedDocument:
    purchases = direction == "PURCHASES"
    return NormalizedDocument(
        dte_type=_required_int(record, "tipoDTE", "tipoDte"),
        dte_type_label=_text(record.get("tipoDTEString")),
        folio=_required_int(record, "folio"),
        counterparty_rut=normalize_rut(record.get("rutProveedor" if purchases else "rutCliente")),
        counterparty_name=_text(record.get("razonSocial")),
        issue_date=_parse_date(record.get("fechaEmision")),
        received_at=_parse_datetime(record.get("fechaRecepcion")),
        acknowledged_at=_parse_datetime(record.get("fechaAcuse")),
        operation_type=_text(record.get("tipoCompra" if purchases else "tipoVenta")),
        status=_text(record.get("estado")),
        acknowledgement=_text(record.get("acuseRecibo")),
        service_indicator=_int_or_none(record.get("indicadorServicio")),
        exempt_amount=_amount(record.get("montoExento")),
        net_amount=_amount(record.get("montoNeto")),
        vat_amount=_amount(record.get("montoIva")),
        vat_recoverable=_amount(record.get("montoIvaRecuperable")),
        vat_non_recoverable=_amount(record.get("montoIvaNoRecuperable")),
        total_amount=_amount(record.get("montoTotal")),
        other_taxes_total=_amount(record.get("totalOtrosImpuestos")),
        reference_dte_type=_int_or_none(record.get("tipoDocReferencia")) or None,
        reference_folio=_text(record.get("folioDocReferencia")),
        raw=dict(record),
    )


def normalize_report(direction: str, body: dict[str, Any]) -> NormalizedReport:
    """Normaliza la respuesta de ``direction`` (``"PURCHASES"`` o ``"SALES"``)."""
    if direction not in _SECTIONS:
        raise ValueError(f"Dirección desconocida: {direction!r}")
    section_key, detail_key = _SECTIONS[direction]
    caratula = body.get("caratula") if isinstance(body, dict) else None
    if not isinstance(caratula, dict):
        raise RCVFormatError("La respuesta no trae carátula")
    section = body.get(section_key)
    if not isinstance(section, dict):
        raise RCVFormatError(f"La respuesta no trae la sección '{section_key}'")
    period = _text(caratula.get("periodo"))
    if not period:
        raise RCVFormatError("La carátula no trae período")
    return NormalizedReport(
        period=period,
        company_rut=normalize_rut(caratula.get("rutEmpresa")),
        summaries=_consolidate_summaries([_normalize_summary(r) for r in section.get("resumenes") or []]),
        documents=[_normalize_document(direction, r) for r in section.get(detail_key) or []],
    )
