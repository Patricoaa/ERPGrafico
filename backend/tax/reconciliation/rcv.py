"""Cuadre del RCV del SII contra facturas y notas del ERP (ADR-0138 D5).

Solo escribe `matched_invoice` / `match_status` en `RCVDocument`; nunca toca la
factura emitida (ADR-0091). Las filas con vínculo manual no se recalculan.
"""

import calendar
from collections import Counter, defaultdict
from datetime import date, timedelta

from django.core.exceptions import ValidationError
from django.db import IntegrityError, models, transaction
from django.db.models import Exists, OuterRef, Q
from django.db.models.functions import Replace, Upper
from django.utils.translation import gettext as _

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
from core.fiscal_match import MatchStatus

# Tipos que se cuadran documento por documento; 39/41/48 van por resumen mensual.
DOCUMENT_SII_CODES = frozenset({33, 34, 56, 61})
CANDIDATE_WINDOW = timedelta(days=60)
RCV_TO_FISCAL_DIRECTION = {
    RCVImport.Direction.PURCHASES: "purchase",
    RCVImport.Direction.SALES: "sale",
}
_NEW_DIFF_FROM = ("", MatchStatus.MATCHED)
_NOT_A_DIFF = (MatchStatus.MATCHED, MatchStatus.EXCLUDED)


@transaction.atomic
def reconcile_rcv_period(
    direction: str, year: int, month: int, rcv_import: RCVImport | None = None
) -> dict[str, int]:
    """Enlaza cada documento RCV del período con su factura; devuelve conteos por estado."""
    start_date = RCVSettings.get_settings().fiscal_match_start_date
    first = date(year, month, 1)
    last = date(year, month, calendar.monthrange(year, month)[1])
    if start_date is None or last < start_date:
        return {}

    selection = RCVDocument.objects.filter(
        direction=direction, period=f"{year}{month:02d}", matched_manually=False
    )
    docs = list(selection.order_by("id"))
    if not docs:
        return {}
    previous = {d.id: d.match_status for d in docs}
    # Limpiar antes de leer los vínculos vigentes: lo que quede enlazado pertenece
    # a filas fuera de esta selección (manuales u otro período) y no se reasigna.
    selection.update(matched_invoice=None, match_status="")

    by_key = _candidates_by_key(RCV_TO_FISCAL_DIRECTION[direction], first, last)
    _assign(docs, by_key)

    RCVDocument.objects.bulk_update(docs, ["matched_invoice", "match_status"], batch_size=500)
    if rcv_import is not None:
        _warn_closed_period(rcv_import, first, docs, previous)
    return dict(Counter(d.match_status for d in docs))


def _candidates_by_key(fiscal_direction: str, first: date, last: date) -> dict[FiscalKey, list[Invoice]]:
    dte_types = [SII_CODE_TO_DTE_TYPE[code] for code in DOCUMENT_SII_CODES] + [Invoice.DTEType.PURCHASE_INV]
    invoices = list(
        Invoice.objects.annotate(fiscal_direction=fiscal_direction_expression())
        .filter(
            Q(dte_type__in=dte_types) | Q(sii_document_code__in=DOCUMENT_SII_CODES),
            status=Invoice.Status.POSTED,
            fiscal_direction=fiscal_direction,
            date__gte=first - CANDIDATE_WINDOW,
            date__lte=last + CANDIDATE_WINDOW,
        )
        .exclude(number="")
        .select_related(*FISCAL_KEY_RELATED)
    )
    taken = set(
        RCVDocument.objects.filter(matched_invoice_id__in=[i.id for i in invoices]).values_list(
            "matched_invoice_id", flat=True
        )
    )
    by_key: dict[FiscalKey, list[Invoice]] = defaultdict(list)
    for invoice in invoices:
        if invoice.id in taken or invoice.sii_code not in DOCUMENT_SII_CODES:
            continue
        key = fiscal_key(invoice)
        if key.folio is not None:
            by_key[key].append(invoice)
    return by_key


def _assign(docs: list[RCVDocument], by_key: dict[FiscalKey, list[Invoice]]) -> None:
    seen: set[FiscalKey] = set()
    for doc in docs:
        doc.matched_invoice = None
        if doc.missing_since_import_id is not None or doc.dte_type not in DOCUMENT_SII_CODES:
            doc.match_status = MatchStatus.EXCLUDED
            continue
        key = FiscalKey(
            RCV_TO_FISCAL_DIRECTION[doc.direction], doc.dte_type, doc.folio, normalize_rut(doc.counterparty_rut)
        )
        matches = by_key.get(key, [])
        if not matches:
            doc.match_status = MatchStatus.ONLY_EXTERNAL
        elif len(matches) > 1 or key in seen:
            doc.match_status = MatchStatus.AMBIGUOUS
        else:
            invoice = matches[0]
            doc.matched_invoice = invoice
            # Valor absoluto: el signo de las NC en el RCV no está garantizado.
            same = abs(doc.total_amount) == invoice.total
            doc.match_status = MatchStatus.MATCHED if same else MatchStatus.AMOUNT_DIFF
        seen.add(key)


def _warn_closed_period(
    rcv_import: RCVImport, first: date, docs: list[RCVDocument], previous: dict[int, str]
) -> None:
    from tax.services import TaxPeriodService

    new_diffs = sum(
        1 for d in docs if previous[d.id] in _NEW_DIFF_FROM and d.match_status not in _NOT_A_DIFF
    )
    if not new_diffs or not TaxPeriodService.is_period_closed(first):
        return
    rcv_import.warnings = [
        *(rcv_import.warnings or []),
        f"Hay {new_diffs} diferencia(s) nueva(s) del RCV en un período tributario cerrado.",
    ]
    rcv_import.save(update_fields=["warnings"])


def _rcv_family(doc: RCVDocument) -> "models.QuerySet[Invoice]":
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


def rcv_document_candidates(doc: RCVDocument) -> "models.QuerySet[Invoice]":
    """Mismo tipo, dirección y RUT normalizado, con folio o total igual; sin otro vínculo RCV."""
    rut = normalize_rut(doc.counterparty_rut)
    body = rut.replace("-", "")
    total = abs(doc.total_amount)
    rows = (
        _rcv_family(doc)
        .annotate(snapshot_rut=rut_body("partner_tax_id_snapshot"), contact_rut=rut_body("contact__tax_id"))
        .filter(Q(snapshot_rut=body) | Q(partner_tax_id_snapshot="", contact_rut=body))
        .filter(Q(total=total) | ~Q(number=""))
        .filter(~Exists(RCVDocument.objects.filter(matched_invoice=OuterRef("pk")).exclude(pk=doc.pk)))
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
            if len(ids) == 20:
                break
    return Invoice.objects.filter(id__in=ids).order_by("id")


@transaction.atomic
def match_rcv_document(doc: RCVDocument, invoice: Invoice, *, allow_draft: bool = False) -> RCVDocument:
    """Vínculo manual: queda protegido del recálculo (`matched_manually`).

    ``allow_draft`` solo lo usa el borrador recién creado desde el RCV (feeding.py).
    """
    statuses = [Invoice.Status.POSTED, Invoice.Status.DRAFT] if allow_draft else [Invoice.Status.POSTED]
    same_direction = Invoice.objects.annotate(fiscal_direction=fiscal_direction_expression()).filter(
        pk=invoice.pk, status__in=statuses, fiscal_direction=RCV_TO_FISCAL_DIRECTION[doc.direction]
    )
    if not same_direction.exists():
        raise ValidationError(_("El documento no es un documento emitido de la misma dirección."))
    taken = _("El documento ya está vinculado a otro documento del RCV.")
    if RCVDocument.objects.filter(matched_invoice=invoice).exclude(pk=doc.pk).exists():
        raise ValidationError(taken)
    doc.matched_invoice = invoice
    doc.matched_manually = True
    same = abs(doc.total_amount) == invoice.total
    doc.match_status = MatchStatus.MATCHED if same else MatchStatus.AMOUNT_DIFF
    try:
        with transaction.atomic():
            doc.save(update_fields=["matched_invoice", "matched_manually", "match_status"])
    except IntegrityError as exc:
        raise ValidationError(taken) from exc
    return doc


@transaction.atomic
def unmatch_rcv_document(doc: RCVDocument) -> RCVDocument:
    doc.matched_invoice = None
    doc.matched_manually = False
    doc.match_status = ""
    doc.save(update_fields=["matched_invoice", "matched_manually", "match_status"])
    return doc
