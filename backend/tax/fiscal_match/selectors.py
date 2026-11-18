"""Lecturas del cuadre por grupo con consultas fijas (ADR-0118, spec §5.7)."""

import re
from decimal import Decimal

from django.db.models import Count, Exists, OuterRef, Prefetch, Q, QuerySet

from accounting.integrations.rcv_normalizer import normalize_rut
from accounting.models import RCVDocument, RCVSettings
from core.fiscal_match import FiscalMatchStatus
from tax.models import FiscalMatch, FiscalMatchRun
from treasury.models import TerminalSale

ATTENTION = "attention"
_SETTLED = (FiscalMatchStatus.MATCHED, FiscalMatchStatus.EXCLUDED)
_LIST_SALE_FIELDS = ("id", "fiscal_match_id", "transaction_at", "sale_amount")
_LIST_RCV_FIELDS = ("id", "fiscal_match_id", "folio")
_DETAIL_SALE_FIELDS = (
    *_LIST_SALE_FIELDS,
    "document_type",
    "payment_type",
    "linked_manually",
    "matched_movement",
    "matched_movement__id",
    "matched_movement__amount",
    "matched_movement__created_at",
)
_DETAIL_RCV_FIELDS = (*_LIST_RCV_FIELDS, "dte_type", "issue_date", "total_amount", "period")


def _status_q(statuses: list[str]) -> Q:
    q = Q(status__in=[s for s in statuses if s != ATTENTION])
    if ATTENTION in statuses:
        q |= ~Q(status__in=_SETTLED)
    return q


def _search_q(term: str) -> Q:
    """Folio RCV, número del documento ERP, RUT de la contraparte o monto exacto."""
    term = term.strip()
    q = Q(invoice__number=term)
    rut = normalize_rut(term)
    if re.fullmatch(r"\d{1,9}-[0-9K]", rut):
        q |= Q(counterparty_rut=rut)
    digits = re.sub(r"[$.\s]", "", term)
    if digits.isdigit() and len(digits) <= 15:  # cabe en BigInteger y en los montos
        value = int(digits)
        amount = Decimal(value)
        q |= Q(erp_amount=amount) | Q(tuu_amount=amount) | Q(rcv_amount=amount)
        q |= Exists(RCVDocument.objects.filter(fiscal_match=OuterRef("pk"), folio=value))
    return q


def _filtered(filters: dict, *, with_status: bool = True) -> QuerySet[FiscalMatch]:
    qs = FiscalMatch.objects.all()
    if direction := filters.get("direction"):
        qs = qs.filter(direction=direction)
    if with_status and (statuses := filters.get("status")):
        qs = qs.filter(_status_q(statuses))
    if (dte_type := filters.get("dte_type")) is not None:
        qs = qs.filter(dte_type=dte_type)
    if date_from := filters.get("date_from"):
        qs = qs.filter(issue_date__gte=date_from)
    if date_to := filters.get("date_to"):
        qs = qs.filter(issue_date__lte=date_to)
    if search := (filters.get("search") or "").strip():
        qs = qs.filter(_search_q(search))
    return qs


def fiscal_matches_queryset(filters: dict) -> QuerySet[FiscalMatch]:
    """Lista filtrada: documento, ventas TUU y folios RCV precargados; orden por fecha."""
    return (
        _filtered(filters)
        .select_related("invoice")
        .prefetch_related(
            Prefetch(
                "terminal_sales",
                queryset=TerminalSale.objects.only(*_LIST_SALE_FIELDS).order_by(
                    "transaction_at", "id"
                ),
            ),
            Prefetch(
                "rcv_documents",
                queryset=RCVDocument.objects.only(*_LIST_RCV_FIELDS).order_by("folio", "id"),
            ),
        )
        .order_by("-issue_date", "-id")
    )


def fiscal_match_detail_queryset() -> QuerySet[FiscalMatch]:
    """Ficha del grupo: ventas TUU con el cobro que respaldan y registros RCV completos."""
    return FiscalMatch.objects.select_related("invoice").prefetch_related(
        Prefetch(
            "terminal_sales",
            queryset=TerminalSale.objects.select_related("matched_movement")
            .only(*_DETAIL_SALE_FIELDS)
            .order_by("transaction_at", "id"),
        ),
        Prefetch(
            "rcv_documents",
            queryset=RCVDocument.objects.only(*_DETAIL_RCV_FIELDS).order_by("folio", "id"),
        ),
    )


def fiscal_match_counts(filters: dict) -> dict:
    """Conteo por estado con los filtros de la lista (salvo ``status``), la última corrida y la fecha
    de inicio del cuadre (``None`` = sin configurar: el motor no evalúa nada)."""
    rows = _filtered(filters, with_status=False).order_by().values("status").annotate(n=Count("id"))
    by_status = dict.fromkeys(FiscalMatchStatus.values, 0)
    by_status.update({row["status"]: row["n"] for row in rows})
    run = (
        FiscalMatchRun.objects.filter(finished_at__isnull=False, error="")
        .order_by("-finished_at", "-id")
        .only("finished_at")
        .first()
    )
    start = RCVSettings.get_settings().fiscal_match_start_date
    return {
        "by_status": by_status,
        "last_run_at": run.finished_at.isoformat() if run else None,
        "start_date": start.isoformat() if start else None,
    }
