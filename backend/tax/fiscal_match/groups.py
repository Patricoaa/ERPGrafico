"""Asegura que exista un grupo de cuadre por documento ERP y por registro huérfano (ADR-0138)."""

from datetime import date
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import F, Q
from django.utils import timezone

from accounting.integrations.rcv_normalizer import normalize_rut
from accounting.models import RCVDocument, RCVImport
from billing.fiscal_key import (
    fiscal_direction_expression,
    resolve_counterparty_rut,
    sii_code_expression,
)
from billing.models import Invoice
from tax.fiscal_match.candidates import local_midnight, sale_document_status_q
from tax.models import FiscalMatch
from treasury.models import TerminalSale

SALE_SII_CODES = (33, 34, 39, 41, 48, 56, 61)
_RCV_DIRECTION = {
    RCVImport.Direction.PURCHASES: FiscalMatch.Direction.PURCHASE,
    RCVImport.Direction.SALES: FiscalMatch.Direction.SALE,
}


def _evaluable_invoice_rows():
    """Documentos ERP que entran al cuadre, con su dirección y código SII anotados."""
    sale = Q(fiscal_direction=FiscalMatch.Direction.SALE, sii_code__in=SALE_SII_CODES) & (
        Q(status=Invoice.Status.POSTED) | (sale_document_status_q() & Q(sale_order__isnull=False))
    )
    purchase = Q(fiscal_direction=FiscalMatch.Direction.PURCHASE, status=Invoice.Status.POSTED)
    return (
        Invoice.objects.annotate(
            fiscal_direction=fiscal_direction_expression(),
            sii_code=sii_code_expression(),
            contact_rut=F("contact__tax_id"),
        )
        .filter(sale | purchase)
        .values("id", "fiscal_direction", "sii_code", "date", "total", "partner_tax_id_snapshot", "contact_rut")
    )


def _evaluable_invoices(since: date):
    return _evaluable_invoice_rows().filter(date__gte=since, fiscal_match_set__isnull=True)


def _invoice_group(row: dict) -> FiscalMatch:
    return FiscalMatch(
        direction=row["fiscal_direction"],
        invoice_id=row["id"],
        dte_type=row["sii_code"],
        issue_date=row["date"],
        fiscal_period=_period(row["date"]),
        counterparty_rut=resolve_counterparty_rut(row["partner_tax_id_snapshot"], row["contact_rut"]),
        erp_amount=row["total"],
    )


def _group_of_invoice(invoice: Invoice) -> FiscalMatch | None:
    return FiscalMatch.objects.filter(invoice=invoice).first()


def group_for_invoice(invoice: Invoice) -> FiscalMatch | None:
    """Grupo del documento, creándolo si falta; ``None`` si el documento no entra al cuadre."""
    group = _group_of_invoice(invoice)
    if group is not None:
        return group
    row = _evaluable_invoice_rows().filter(id=invoice.pk).first()
    if row is None:
        return None
    group = _invoice_group(row)
    try:
        with transaction.atomic():
            group.save()
    except IntegrityError:  # otro proceso lo creó entre la lectura y el INSERT
        return _group_of_invoice(invoice)
    return group


def _period(day: date) -> str:
    return f"{day:%Y%m}"


def rcv_orphan_group(doc: RCVDocument) -> FiscalMatch:
    """Grupo huérfano (sin guardar) para un documento RCV sin documento ERP."""
    return FiscalMatch(
        direction=_RCV_DIRECTION[doc.direction],
        dte_type=doc.dte_type,
        issue_date=doc.issue_date,
        fiscal_period=doc.period,
        counterparty_rut=normalize_rut(doc.counterparty_rut),
        rcv_amount=abs(doc.total_amount),
    )


def tuu_orphan_group(sale: TerminalSale) -> FiscalMatch:
    """Grupo huérfano (sin guardar) para una venta TUU sin documento ERP."""
    day = timezone.localdate(sale.transaction_at)
    return FiscalMatch(
        direction=FiscalMatch.Direction.SALE,
        dte_type=sale.document_type,
        issue_date=day,
        fiscal_period=_period(day),
        tuu_amount=Decimal(sale.sale_amount),
    )


@transaction.atomic
def ensure_groups(since: date) -> int:
    """Crea los grupos que faltan desde ``since``; devuelve cuántos creó."""
    invoice_groups = [_invoice_group(row) for row in _evaluable_invoices(since)]

    rcv_docs = list(RCVDocument.objects.filter(fiscal_match__isnull=True, issue_date__gte=since))
    rcv_groups = [rcv_orphan_group(doc) for doc in rcv_docs]

    sales = list(
        TerminalSale.objects.filter(
            status=TerminalSale.Status.COMPLETED,
            fiscal_match__isnull=True,
            transaction_at__gte=local_midnight(since),
        )
    )
    tuu_groups = [tuu_orphan_group(sale) for sale in sales]
    # Un solo INSERT para todos los grupos: el conteo de consultas no crece con las filas.
    FiscalMatch.objects.bulk_create(invoice_groups + rcv_groups + tuu_groups)
    for doc, group in zip(rcv_docs, rcv_groups, strict=True):
        doc.fiscal_match = group
    RCVDocument.objects.bulk_update(rcv_docs, ["fiscal_match"])
    for sale, group in zip(sales, tuu_groups, strict=True):
        sale.fiscal_match = group
    TerminalSale.objects.bulk_update(sales, ["fiscal_match"])

    return len(invoice_groups) + len(rcv_groups) + len(tuu_groups)
