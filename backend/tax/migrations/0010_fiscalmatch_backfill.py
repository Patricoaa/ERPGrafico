"""Migra los vínculos de cuadre por pares a grupos ``FiscalMatch`` (spec cuadre unificado §7).

Solo usa modelos históricos. Los estados quedan en PENDING: la primera corrida del motor
los deriva y recalcula los campos derivados.
"""

from decimal import Decimal

from django.db import migrations

_CHUNK = 5000
_DIRECTION = {"PURCHASES": "purchase", "SALES": "sale"}


def _chunks(values):
    values = list(values)
    for i in range(0, len(values), _CHUNK):
        yield values[i : i + _CHUNK]


def _rut(raw):
    return "".join(ch for ch in (raw or "") if ch.isalnum()).upper()


def _period(day):
    return f"{day:%Y%m}" if day else ""


def _attempt(sales):
    """Último intento de emisión de las ventas (fecha, error)."""
    tried = [s for s in sales if s.issue_attempted_at]
    if not tried:
        return None, ""
    last = max(tried, key=lambda s: s.issue_attempted_at)
    return last.issue_attempted_at, last.issue_error or ""


def _backfill_invoice_groups(apps, FiscalMatch, TerminalSale, RCVDocument):
    Invoice = apps.get_model("billing", "Invoice")
    TreasuryMovement = apps.get_model("treasury", "TreasuryMovement")

    sales = list(TerminalSale.objects.filter(matched_invoice__isnull=False, fiscal_match__isnull=True))
    rcvs = list(RCVDocument.objects.filter(matched_invoice__isnull=False, fiscal_match__isnull=True))
    invoice_ids = {s.matched_invoice_id for s in sales} | {d.matched_invoice_id for d in rcvs}
    if not invoice_ids:
        return

    sales_by_inv, rcvs_by_inv = {}, {}
    for s in sales:
        sales_by_inv.setdefault(s.matched_invoice_id, []).append(s)
    for d in rcvs:
        rcvs_by_inv.setdefault(d.matched_invoice_id, []).append(d)

    groups = {}
    for ids in _chunks(invoice_ids):
        for g in FiscalMatch.objects.filter(invoice_id__in=ids):
            groups[g.invoice_id] = g
    invoices = {}
    for ids in _chunks(invoice_ids - set(groups)):
        invoices.update({i.id: i for i in Invoice.objects.filter(id__in=ids)})

    new_groups = []
    for inv_id, invoice in invoices.items():
        docs = rcvs_by_inv.get(inv_id, [])
        doc = docs[0] if docs else None
        issue_date = doc.issue_date if doc else invoice.date
        attempted_at, error = _attempt(sales_by_inv.get(inv_id, []))
        new_groups.append(
            FiscalMatch(
                direction=_DIRECTION[doc.direction] if doc else "sale",
                invoice_id=inv_id,
                dte_type=doc.dte_type if doc else None,
                issue_date=issue_date,
                fiscal_period=doc.period if doc else _period(issue_date),
                counterparty_rut=_rut(doc.counterparty_rut) if doc else "",
                erp_amount=invoice.total,
                issue_attempted_at=attempted_at,
                issue_error=error[:255],
            )
        )
    for g in FiscalMatch.objects.bulk_create(new_groups):
        groups[g.invoice_id] = g

    # Grupos reutilizados: conservar el intento de emisión y el flag manual si faltan.
    touched = []
    for inv_id, g in groups.items():
        if inv_id not in invoice_ids:
            continue
        changed = False
        attempted_at, error = _attempt(sales_by_inv.get(inv_id, []))
        if attempted_at and not g.issue_attempted_at:
            g.issue_attempted_at, g.issue_error, changed = attempted_at, error[:255], True
        if changed:
            touched.append(g)
    if touched:
        FiscalMatch.objects.bulk_update(touched, ["issue_attempted_at", "issue_error"])

    manual_groups = []
    for inv_id, docs in rcvs_by_inv.items():
        g = groups[inv_id]
        for d in docs:
            d.fiscal_match_id = g.id
        if any(d.matched_manually for d in docs) and not g.rcv_linked_manually:
            g.rcv_linked_manually = True
            manual_groups.append(g)
    if manual_groups:
        FiscalMatch.objects.bulk_update(manual_groups, ["rcv_linked_manually"])
    RCVDocument.objects.bulk_update(rcvs, ["fiscal_match"], batch_size=_CHUNK)

    movements = {}
    for ids in _chunks(invoice_ids):
        for m in TreasuryMovement.objects.filter(invoice_id__in=ids).only("id", "invoice_id", "amount"):
            movements.setdefault(m.invoice_id, []).append(m)
    for inv_id, inv_sales in sales_by_inv.items():
        for s in inv_sales:
            s.fiscal_match_id = groups[inv_id].id
            s.linked_manually = bool(s.matched_manually)
            same_sale = [x for x in inv_sales if x.sale_amount == s.sale_amount]
            candidates = [m for m in movements.get(inv_id, []) if m.amount == Decimal(s.sale_amount)]
            if len(same_sale) == 1 and len(candidates) == 1:
                s.matched_movement_id = candidates[0].id
    TerminalSale.objects.bulk_update(
        sales, ["fiscal_match", "linked_manually", "matched_movement"], batch_size=_CHUNK
    )


def _backfill_orphan_groups(FiscalMatch, TerminalSale, RCVDocument):
    """Venta TUU con boleta RCV pero sin documento ERP (PENDING_ERP): grupo huérfano con ambos."""
    sales = list(
        TerminalSale.objects.filter(
            rcv_document__isnull=False, matched_invoice__isnull=True, fiscal_match__isnull=True
        ).select_related("rcv_document")
    )
    if not sales:
        return
    by_doc = {}
    for s in sales:
        by_doc.setdefault(s.rcv_document_id, []).append(s)

    group_of = {}
    new_docs = []
    for doc_id, doc_sales in by_doc.items():
        doc = doc_sales[0].rcv_document
        if doc.fiscal_match_id:
            group_of[doc_id] = doc.fiscal_match_id
        else:
            new_docs.append(doc)
    new_groups = []
    for doc in new_docs:
        doc_sales = by_doc[doc.id]
        attempted_at, error = _attempt(doc_sales)
        new_groups.append(
            FiscalMatch(
                direction="sale",
                dte_type=doc.dte_type,
                issue_date=doc.issue_date,
                fiscal_period=doc.period,
                counterparty_rut=_rut(doc.counterparty_rut),
                rcv_amount=abs(doc.total_amount),
                tuu_amount=sum((Decimal(s.sale_amount) for s in doc_sales), Decimal(0)),
                issue_attempted_at=attempted_at,
                issue_error=error[:255],
            )
        )
    for doc, g in zip(new_docs, FiscalMatch.objects.bulk_create(new_groups), strict=True):
        group_of[doc.id] = g.id
        doc.fiscal_match_id = g.id
    RCVDocument.objects.bulk_update(new_docs, ["fiscal_match"], batch_size=_CHUNK)
    for s in sales:
        s.fiscal_match_id = group_of[s.rcv_document_id]
        s.linked_manually = bool(s.matched_manually)
    TerminalSale.objects.bulk_update(sales, ["fiscal_match", "linked_manually"], batch_size=_CHUNK)


def backfill(apps, schema_editor):
    FiscalMatch = apps.get_model("tax", "FiscalMatch")
    TerminalSale = apps.get_model("treasury", "TerminalSale")
    RCVDocument = apps.get_model("accounting", "RCVDocument")
    _backfill_invoice_groups(apps, FiscalMatch, TerminalSale, RCVDocument)
    _backfill_orphan_groups(FiscalMatch, TerminalSale, RCVDocument)


class Migration(migrations.Migration):
    dependencies = [
        ("accounting", "0050_rcvdocument_fiscal_match"),
        ("billing", "0022_invoice_fiscal_snapshot"),
        ("tax", "0009_fiscalmatch"),
        ("treasury", "0112_terminalsale_fiscal_match"),
    ]

    operations = [migrations.RunPython(backfill, reverse_code=migrations.RunPython.noop)]
