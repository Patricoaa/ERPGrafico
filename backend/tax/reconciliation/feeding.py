"""El RCV completa borradores de compra y crea borradores desde una OC (ADR-0138 D8).

Nada corre solo: cada función responde a un clic explícito en la ficha del documento
RCV. Solo aplica a documentos de compras que el cuadre dejó en «Falta en el ERP».
"""

from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.db.models import Exists, OuterRef
from django.utils.translation import gettext as _

from accounting.integrations.rcv_normalizer import normalize_rut
from accounting.models import RCVDocument, RCVImport
from billing.fiscal_key import fiscal_direction_expression, sii_code_expression
from billing.models import SII_CODE_TO_DTE_TYPE, Invoice
from core.fiscal_match import MatchStatus
from purchasing.models import PurchaseOrder

from .rcv import match_rcv_document, rut_body

# «Total parecido» para sugerir un borrador: diferencia de hasta 2 %.
SUGGESTION_TOLERANCE = Decimal("0.02")
MAX_SUGGESTIONS = 10
MAX_PURCHASE_ORDERS = 20
# Códigos que `create_purchase_bill` registra desde una OC; las notas (56/61) corrigen
# una factura y el 48 es un comprobante de venta.
PURCHASE_BILL_SII_CODES = frozenset({33, 34, 39, 41})


def _is_pending_purchase(doc: RCVDocument) -> bool:
    return doc.direction == RCVImport.Direction.PURCHASES and doc.match_status == MatchStatus.ONLY_EXTERNAL


def _require_pending_purchase(doc: RCVDocument) -> None:
    if not _is_pending_purchase(doc):
        raise ValidationError(_("Solo se registran documentos de compra que faltan en el ERP."))


def _draft_rut(invoice: Invoice) -> str:
    """RUT del borrador: snapshot, luego contacto, luego proveedor de la OC."""
    rut = invoice.partner_tax_id_snapshot
    if not rut and invoice.contact_id:
        rut = invoice.contact.tax_id
    if not rut and invoice.purchase_order_id:
        rut = invoice.purchase_order.supplier.tax_id
    return normalize_rut(rut)


def _purchase_drafts() -> "models.QuerySet[Invoice]":
    return Invoice.objects.annotate(fiscal_direction=fiscal_direction_expression()).filter(
        status=Invoice.Status.DRAFT, fiscal_direction="purchase"
    )


def draft_suggestions(doc: RCVDocument) -> list[Invoice]:
    """Borradores de compra del mismo RUT con total a ≤ 2 %, del más parecido al menos; máximo 10."""
    rut = normalize_rut(doc.counterparty_rut)
    if not _is_pending_purchase(doc) or not rut:
        return []
    total = abs(doc.total_amount)
    margin = total * SUGGESTION_TOLERANCE
    rows = (
        _purchase_drafts()
        .annotate(sii=sii_code_expression())
        .filter(sii=doc.dte_type, total__gte=total - margin, total__lte=total + margin)
        .filter(~Exists(RCVDocument.objects.filter(matched_invoice=OuterRef("pk"))))
        .select_related("contact", "purchase_order__supplier")
    )
    matches = [invoice for invoice in rows if _draft_rut(invoice) == rut]
    matches.sort(key=lambda invoice: (abs(invoice.total - total), invoice.id))
    return matches[:MAX_SUGGESTIONS]


def supplier_purchase_orders(doc: RCVDocument) -> list[PurchaseOrder]:
    """OC no anuladas del proveedor con el RUT del documento; las más recientes primero, máximo 20."""
    rut = normalize_rut(doc.counterparty_rut)
    if not _is_pending_purchase(doc) or not rut:
        return []
    rows = (
        PurchaseOrder.objects.annotate(supplier_rut=rut_body("supplier__tax_id"))
        .filter(supplier_rut=rut.replace("-", ""))
        .exclude(status=PurchaseOrder.Status.CANCELLED)
        .select_related("supplier")
        .order_by("-date", "-id")
    )
    return [order for order in rows[:MAX_PURCHASE_ORDERS] if normalize_rut(order.supplier.tax_id) == rut]


@transaction.atomic
def confirm_draft_from_rcv(doc: RCVDocument, invoice: Invoice, attachment=None) -> Invoice:
    """Asigna folio y fecha del RCV al borrador, lo emite y lo vincula; si el vínculo falla, nada queda."""
    from billing.services import BillingService

    _require_pending_purchase(doc)
    draft = _purchase_drafts().select_related("contact", "purchase_order__supplier").filter(pk=invoice.pk).first()
    if draft is None:
        raise ValidationError(_("La factura no es un borrador de compra."))
    if _draft_rut(draft) != normalize_rut(doc.counterparty_rut):
        raise ValidationError(_("El borrador no corresponde al proveedor del documento."))
    if draft.sii_code != doc.dte_type:
        raise ValidationError(_("El tipo del borrador no coincide con el tipo del documento."))
    BillingService.confirm_invoice(
        invoice, number=str(doc.folio), document_attachment=attachment, date=doc.issue_date
    )
    match_rcv_document(doc, invoice)
    return invoice


@transaction.atomic
def create_draft_from_rcv(doc: RCVDocument, purchase_order: PurchaseOrder) -> Invoice:
    """Crea un borrador de compra desde la OC con el folio y la fecha del RCV, ya vinculado al documento."""
    from billing.services import BillingService

    _require_pending_purchase(doc)
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
    # El borrador queda vinculado: el documento deja de figurar como «Falta en el ERP».
    match_rcv_document(doc, invoice, allow_draft=True)
    return invoice
