"""El RCV completa borradores de compra y crea borradores desde una OC, sobre el grupo (ADR-0138 D8).

Nada corre solo: cada función responde a un clic explícito en la ficha del grupo. Solo aplica
a grupos de compra huérfanos con un único documento del SII, es decir, «Falta en el ERP».
"""

from django.core.exceptions import ValidationError
from django.db.models import Exists, OuterRef
from django.utils.translation import gettext as _

from accounting.integrations.rcv_normalizer import normalize_rut
from accounting.models import RCVDocument
from billing.fiscal_key import sii_code_expression
from billing.models import SII_CODE_TO_DTE_TYPE, Invoice
from purchasing.models import PurchaseOrder
from tax.fiscal_match.groups import group_for_invoice
from tax.fiscal_match.rcv import rut_body
from tax.fiscal_match.services import (
    _drop_empty,
    _exclusive,
    _fresh,
    _lock_groups,
    _locked,
    _rederive,
)
from tax.models import FiscalMatch
from tax.reconciliation.feeding import (
    MAX_PURCHASE_ORDERS,
    MAX_SUGGESTIONS,
    PURCHASE_BILL_SII_CODES,
    SUGGESTION_TOLERANCE,
    _draft_rut,
    _purchase_drafts,
)
from treasury.models import TerminalSale


def _pending_doc(group: FiscalMatch) -> RCVDocument | None:
    """El documento del SII de un grupo de compra huérfano con solo ese registro; si no, ``None``."""
    if group.direction != FiscalMatch.Direction.PURCHASE or group.invoice_id is not None:
        return None
    docs = list(RCVDocument.objects.filter(fiscal_match=group).order_by("id")[:2])
    if len(docs) != 1 or TerminalSale.objects.filter(fiscal_match=group).exists():
        return None
    return docs[0]


def _require_pending_doc(group: FiscalMatch) -> RCVDocument:
    doc = _pending_doc(group)
    if doc is None:
        raise ValidationError(_("Solo se registran documentos de compra que faltan en el ERP."))
    return doc


def draft_suggestions(group: FiscalMatch) -> list[Invoice]:
    """Borradores de compra del mismo RUT con total a ≤ 2 %, del más parecido al menos; máximo 10."""
    doc = _pending_doc(group)
    rut = normalize_rut(doc.counterparty_rut) if doc else ""
    if doc is None or not rut:
        return []
    total = abs(doc.total_amount)
    margin = total * SUGGESTION_TOLERANCE
    rows = (
        _purchase_drafts()
        .annotate(sii=sii_code_expression())
        .filter(sii=doc.dte_type, total__gte=total - margin, total__lte=total + margin)
        .filter(~Exists(RCVDocument.objects.filter(fiscal_match__invoice=OuterRef("pk"))))
        .select_related("contact", "purchase_order__supplier")
    )
    matches = [invoice for invoice in rows if _draft_rut(invoice) == rut]
    matches.sort(key=lambda invoice: (abs(invoice.total - total), invoice.id))
    return matches[:MAX_SUGGESTIONS]


def supplier_purchase_orders(group: FiscalMatch) -> list[PurchaseOrder]:
    """OC no anuladas del proveedor con el RUT del documento; las más recientes primero, máximo 20."""
    doc = _pending_doc(group)
    rut = normalize_rut(doc.counterparty_rut) if doc else ""
    if doc is None or not rut:
        return []
    rows = (
        PurchaseOrder.objects.annotate(supplier_rut=rut_body("supplier__tax_id"))
        .filter(supplier_rut=rut.replace("-", ""))
        .exclude(status=PurchaseOrder.Status.CANCELLED)
        .select_related("supplier")
        .order_by("-date", "-id")
    )
    return [order for order in rows[:MAX_PURCHASE_ORDERS] if normalize_rut(order.supplier.tax_id) == rut]


def _lock_pending(group: FiscalMatch) -> tuple[FiscalMatch, RCVDocument]:
    group = _locked(_lock_groups(group.pk), group.pk)
    doc = _require_pending_doc(group)
    return group, RCVDocument.objects.select_for_update().get(pk=doc.pk)


def _adopt(orphan: FiscalMatch, doc: RCVDocument, invoice: Invoice) -> FiscalMatch:
    """Mueve el documento del SII al grupo de la factura, como vínculo manual, y re-deriva ambos."""
    target = group_for_invoice(invoice, purchase_drafts=True)
    if target is None:
        raise ValidationError(_("El documento no entra al cuadre."))
    target = _locked(_lock_groups(orphan.pk, target.pk), target.pk)
    if RCVDocument.objects.filter(fiscal_match=target).exists():
        raise ValidationError(_("El documento del ERP ya tiene un registro del SII."))
    doc.fiscal_match = target
    doc.save(update_fields=["fiscal_match"])
    target.rcv_linked_manually = True
    update = ["rcv_linked_manually"]
    if not target.counterparty_rut:  # borrador cuyo RUT solo consta en la OC
        target.counterparty_rut = normalize_rut(doc.counterparty_rut)
        update.append("counterparty_rut")
    target.save(update_fields=update)
    _drop_empty({orphan.pk})
    _rederive({orphan.pk, target.pk})
    return _fresh(target.pk)


@_exclusive
def confirm_draft_from_rcv(group: FiscalMatch, invoice: Invoice, attachment=None) -> FiscalMatch:
    """Asigna folio y fecha del RCV al borrador, lo emite y lo une al documento; si falla, nada queda."""
    from billing.services import BillingService

    orphan, doc = _lock_pending(group)
    draft = _purchase_drafts().select_related("contact", "purchase_order__supplier").filter(pk=invoice.pk).first()
    if draft is None:
        raise ValidationError(_("La factura no es un borrador de compra."))
    if _draft_rut(draft) != normalize_rut(doc.counterparty_rut):
        raise ValidationError(_("El borrador no corresponde al proveedor del documento."))
    if draft.sii_code != doc.dte_type:
        raise ValidationError(_("El tipo del borrador no coincide con el tipo del documento."))
    if RCVDocument.objects.filter(fiscal_match__invoice=draft).exists():
        raise ValidationError(_("El borrador ya tiene un registro del SII."))
    BillingService.confirm_invoice(
        invoice, number=str(doc.folio), document_attachment=attachment, date=doc.issue_date
    )
    return _adopt(orphan, doc, invoice)


@_exclusive
def create_draft_from_rcv(group: FiscalMatch, purchase_order: PurchaseOrder) -> FiscalMatch:
    """Crea un borrador de compra desde la OC con el folio y la fecha del RCV, ya unido al documento."""
    from billing.services import BillingService

    orphan, doc = _lock_pending(group)
    if doc.dte_type not in PURCHASE_BILL_SII_CODES:
        raise ValidationError(_("Este tipo de documento no se puede registrar desde una OC."))
    if purchase_order.status == PurchaseOrder.Status.CANCELLED:
        raise ValidationError(_("La OC está anulada."))
    if normalize_rut(purchase_order.supplier.tax_id) != normalize_rut(doc.counterparty_rut):
        raise ValidationError(_("El proveedor de la OC no coincide con el RUT del documento."))
    invoice = BillingService.create_purchase_bill(
        purchase_order,
        supplier_invoice_number=str(doc.folio),
        dte_type=SII_CODE_TO_DTE_TYPE[doc.dte_type],
        date=doc.issue_date,
        status=Invoice.Status.DRAFT,
    )
    return _adopt(orphan, doc, invoice)
