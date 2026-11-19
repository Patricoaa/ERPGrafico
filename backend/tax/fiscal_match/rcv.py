"""ERP ↔ RCV por clave fiscal: facturas y notas entran al grupo de su documento (ADR-0138 D5)."""

from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal

from django.db import models, transaction
from django.db.models import Exists, OuterRef, Q
from django.db.models.functions import Replace, Upper
from django.utils import timezone

from accounting.integrations.rcv_normalizer import normalize_rut
from accounting.models import RCVDocument, RCVImport, RCVSettings
from billing.fiscal_key import (
    FISCAL_KEY_RELATED,
    FiscalKey,
    fiscal_direction_expression,
    fiscal_key,
    sii_code_expression,
)
from billing.models import SII_CODE_TO_DTE_TYPE, Invoice
from tax.fiscal_match.candidates import LinkResult, local_midnight, stamp_groups
from tax.models import FiscalMatch
from treasury.models import TerminalSale

# Tipos que se cuadran documento por documento; 48 va por resumen mensual.
DOCUMENT_SII_CODES = frozenset({33, 34, 56, 61})
FACTURA_SII_CODES = frozenset({33, 34})
CANDIDATE_WINDOW = timedelta(days=60)
RCV_TO_FISCAL_DIRECTION = {
    RCVImport.Direction.PURCHASES: "purchase",
    RCVImport.Direction.SALES: "sale",
}
_CANDIDATE_CAP = 20


def rcv_family(doc: RCVDocument) -> "models.QuerySet[Invoice]":
    """Facturas emitidas de la misma dirección y código SII que el documento RCV."""
    return Invoice.objects.annotate(
        fiscal_direction=fiscal_direction_expression(), sii=sii_code_expression()
    ).filter(
        sii=doc.dte_type,
        status=Invoice.Status.POSTED,
        fiscal_direction=RCV_TO_FISCAL_DIRECTION[doc.direction],
    )


def rut_body(field: str) -> Upper:
    """RUT sin puntos, espacios ni guion, en mayúscula, como expresión ORM."""
    expr = models.F(field)
    for char in (".", " ", "-"):
        expr = Replace(expr, models.Value(char), models.Value(""))
    return Upper(expr)


def rcv_group_candidates(doc: RCVDocument) -> "models.QuerySet[Invoice]":
    """Mismo tipo, dirección y RUT, con folio o total igual; su grupo sin otro RCV."""
    rut = normalize_rut(doc.counterparty_rut)
    body = rut.replace("-", "")
    total = abs(doc.total_amount)
    taken = RCVDocument.objects.filter(fiscal_match__invoice=OuterRef("pk")).exclude(pk=doc.pk)
    rows = (
        rcv_family(doc)
        .annotate(
            snapshot_rut=rut_body("partner_tax_id_snapshot"),
            contact_rut=rut_body("contact__tax_id"),
        )
        .filter(Q(snapshot_rut=body) | Q(partner_tax_id_snapshot="", contact_rut=body))
        .filter(Q(total=total) | ~Q(number=""))
        .filter(~Exists(taken))
        .select_related(*FISCAL_KEY_RELATED)
        .order_by("id")
    )
    ids = []
    for invoice in rows:
        key = fiscal_key(invoice)
        if key.counterparty_rut != rut:
            continue
        if key.folio == doc.folio or invoice.total == total:
            ids.append(invoice.id)
            if len(ids) == _CANDIDATE_CAP:
                break
    return Invoice.objects.filter(id__in=ids).order_by("id")


def candidates_by_key(
    fiscal_direction: str | None, first: date, last: date
) -> dict[FiscalKey, list[tuple[int, int]]]:
    """Clave fiscal → [(invoice_id, group_id)] de facturas contabilizadas sin RCV en su grupo."""
    dte_types = [SII_CODE_TO_DTE_TYPE[code] for code in DOCUMENT_SII_CODES] + [
        Invoice.DTEType.PURCHASE_INV
    ]
    taken = RCVDocument.objects.filter(fiscal_match__invoice=OuterRef("pk"))
    groups = FiscalMatch.objects.filter(invoice=OuterRef("pk"))
    invoices = (
        Invoice.objects.annotate(fiscal_direction=fiscal_direction_expression())
        .filter(
            Q(dte_type__in=dte_types) | Q(sii_document_code__in=DOCUMENT_SII_CODES),
            Exists(groups),
            ~Exists(taken),
            status=Invoice.Status.POSTED,
            date__gte=first - CANDIDATE_WINDOW,
            date__lte=last + CANDIDATE_WINDOW,
        )
        .exclude(number="")
        .select_related(*FISCAL_KEY_RELATED)
    )
    if fiscal_direction is not None:
        invoices = invoices.filter(fiscal_direction=fiscal_direction)
    invoices = list(invoices)
    group_of = dict(
        FiscalMatch.objects.filter(invoice_id__in=[i.id for i in invoices]).values_list(
            "invoice_id", "id"
        )
    )
    by_key: dict[FiscalKey, list[tuple[int, int]]] = defaultdict(list)
    for invoice in invoices:
        if invoice.sii_code not in DOCUMENT_SII_CODES:
            continue
        key = fiscal_key(invoice)
        if key.folio is not None:
            by_key[key].append((invoice.id, group_of[invoice.id]))
    return by_key


@transaction.atomic
def link_rcv_documents(since: date) -> LinkResult:
    """Mueve cada documento RCV huérfano al grupo de su factura por clave fiscal exacta."""
    start = RCVSettings.get_settings().fiscal_match_start_date
    if start is None:
        return LinkResult(0)
    docs = list(
        RCVDocument.objects.filter(
            dte_type__in=DOCUMENT_SII_CODES,
            missing_since_import__isnull=True,
            issue_date__gte=since,
            fiscal_match__invoice__isnull=True,
            fiscal_match__rcv_linked_manually=False,
        ).order_by("id")
    )
    if not docs:
        return LinkResult(0)
    first = min(d.issue_date for d in docs)
    last = max(d.issue_date for d in docs)
    by_key = candidates_by_key(None, first, last)
    doc_keys = [
        FiscalKey(
            RCV_TO_FISCAL_DIRECTION[d.direction],
            d.dte_type,
            d.folio,
            normalize_rut(d.counterparty_rut),
        )
        for d in docs
    ]
    repeated = {k for k, n in Counter(doc_keys).items() if n > 1}

    ambiguous: set[int] = set()
    moved: list[RCVDocument] = []
    emptied: set[int] = set()
    touched: set[int] = set()
    target_by_source: dict[int, int] = {}
    for doc, key in zip(docs, doc_keys, strict=True):
        matches = by_key.get(key, [])
        if not matches:
            continue
        if len(matches) > 1 or key in repeated:
            ambiguous.add(doc.fiscal_match_id)
            continue
        emptied.add(doc.fiscal_match_id)
        target = matches[0][1]
        target_by_source[doc.fiscal_match_id] = target
        touched |= {doc.fiscal_match_id, target}
        doc.fiscal_match_id = target
        moved.append(doc)
    if moved:
        RCVDocument.objects.bulk_update(moved, ["fiscal_match"], batch_size=500)
        # Si el grupo huérfano RCV contenía ventas TUU que se habían cruzado con él, viajan al grupo del documento
        sales_to_move = list(TerminalSale.objects.filter(fiscal_match_id__in=emptied))
        for sale in sales_to_move:
            sale.fiscal_match_id = target_by_source[sale.fiscal_match_id]
        if sales_to_move:
            TerminalSale.objects.bulk_update(sales_to_move, ["fiscal_match"], batch_size=500)
        FiscalMatch.objects.filter(
            id__in=emptied,
            invoice__isnull=True,
            terminal_sales__isnull=True,
            rcv_documents__isnull=True,
        ).delete()
    stamp_groups(touched)
    return LinkResult(len(moved), ambiguous, touched)


@transaction.atomic
def pair_orphan_tuu_rcv_facturas(
    lo: datetime, hi: datetime, *, exclude_group_ids: set[int] = frozenset()
) -> LinkResult:
    """Une ventas TUU huérfanas (DTE 33/34) con facturas RCV huérfanas del mismo tipo, fecha y monto."""
    start = RCVSettings.get_settings().fiscal_match_start_date
    if start is None:
        return LinkResult(0)
    lo = max(lo, local_midnight(start))
    if lo >= hi:
        return LinkResult(0)
    first_day = timezone.localdate(lo)
    last_day = timezone.localdate(hi - timedelta(microseconds=1))

    cancelled_invoices = Invoice.objects.filter(
        status=Invoice.Status.CANCELLED,
        date=OuterRef("issue_date"),
        total=OuterRef("total_amount"),
    )

    # Ventas TUU completadas, de tipo 33 o 34, huérfanas (sin factura ERP) y cuyo grupo no tiene aún RCV
    sales_qs = TerminalSale.objects.filter(
        status=TerminalSale.Status.COMPLETED,
        document_type__in=FACTURA_SII_CODES,
        transaction_at__gte=local_midnight(first_day),
        transaction_at__lt=local_midnight(last_day + timedelta(days=1)),
        fiscal_match__isnull=False,
        fiscal_match__invoice__isnull=True,
        fiscal_match__rcv_documents__isnull=True,
        linked_manually=False,
    )
    if exclude_group_ids:
        sales_qs = sales_qs.exclude(fiscal_match_id__in=exclude_group_ids)
    sales = list(sales_qs.order_by("transaction_at", "id"))
    if not sales:
        return LinkResult(0)

    # Documentos RCV de venta, tipo 33 o 34, huérfanos (sin factura ERP) y cuyo grupo no tiene aún ventas TUU,
    # excluyendo documentos asociados a facturas que fueron anuladas en el ERP.
    docs_qs = RCVDocument.objects.filter(
        direction=RCVImport.Direction.SALES,
        dte_type__in=FACTURA_SII_CODES,
        missing_since_import__isnull=True,
        issue_date__gte=first_day,
        issue_date__lte=last_day,
        fiscal_match__invoice__isnull=True,
        fiscal_match__terminal_sales__isnull=True,
        fiscal_match__rcv_linked_manually=False,
    ).exclude(Exists(cancelled_invoices))
    if exclude_group_ids:
        docs_qs = docs_qs.exclude(fiscal_match_id__in=exclude_group_ids)
    docs = list(docs_qs.order_by("issue_date", "id"))
    if not docs:
        return LinkResult(0)

    # Agrupar por (fecha, monto, dte_type)
    sales_by_key: dict[tuple[date, Decimal, int], list[TerminalSale]] = defaultdict(list)
    for s in sales:
        day = timezone.localdate(s.transaction_at)
        sales_by_key[(day, Decimal(s.sale_amount), s.document_type)].append(s)

    docs_by_key: dict[tuple[date, Decimal, int], list[RCVDocument]] = defaultdict(list)
    for d in docs:
        docs_by_key[(d.issue_date, abs(d.total_amount), d.dte_type)].append(d)

    ambiguous: set[int] = set()
    moved_sales: list[TerminalSale] = []
    emptied_groups: set[int] = set()
    touched: set[int] = set()

    for key, key_sales in sales_by_key.items():
        key_docs = docs_by_key.get(key, [])
        if not key_docs:
            continue
        # Si hay más de una venta o más de un documento para la misma fecha y monto:
        # No adivinamos qué venta corresponde a qué factura (tienen folios y clientes distintos)
        if len(key_sales) > 1 or len(key_docs) > 1:
            for s in key_sales:
                ambiguous.add(s.fiscal_match_id)
            for d in key_docs:
                ambiguous.add(d.fiscal_match_id)
            continue

        sale = key_sales[0]
        doc = key_docs[0]
        target_group_id = doc.fiscal_match_id
        source_group_id = sale.fiscal_match_id

        if source_group_id == target_group_id:
            continue

        emptied_groups.add(source_group_id)
        touched |= {source_group_id, target_group_id}
        sale.fiscal_match_id = target_group_id
        moved_sales.append(sale)

    if moved_sales:
        TerminalSale.objects.bulk_update(moved_sales, ["fiscal_match"], batch_size=500)
        FiscalMatch.objects.filter(
            id__in=emptied_groups,
            invoice__isnull=True,
            terminal_sales__isnull=True,
            rcv_documents__isnull=True,
        ).delete()

    stamp_groups(touched)
    return LinkResult(len(moved_sales), ambiguous, touched)
