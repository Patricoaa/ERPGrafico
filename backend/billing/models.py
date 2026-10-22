from django.contrib.contenttypes.fields import GenericForeignKey, GenericRelation
from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.utils.translation import gettext_lazy as _

from accounting.models import JournalEntry
from core.edit_policy import DRAFT_ONLY_DOCUMENT
from core.models import TransactionalDocument
from core.storages import PrivateMediaStorage
from core.utils import generic_upload_path, get_current_date
from core.validators import validate_file_extension, validate_file_size
from purchasing.models import PurchaseOrder
from sales.models import SaleOrder


class Invoice(TransactionalDocument):
    edit_policy = DRAFT_ONLY_DOCUMENT  # ADR-0091

    class DTEType(models.TextChoices):
        FACTURA = "FACTURA", _("Factura Electrónica")
        FACTURA_EXENTA = "FACTURA_EXENTA", _("Factura No Afecta o Exenta")
        BOLETA = "BOLETA", _("Boleta Electrónica")
        BOLETA_EXENTA = "BOLETA_EXENTA", _("Boleta No Afecta o Exenta")
        PURCHASE_INV = "PURCHASE_INV", _("Factura de Compra")
        NOTA_CREDITO = "NOTA_CREDITO", _("Nota de Crédito")
        NOTA_DEBITO = "NOTA_DEBITO", _("Nota de Débito")
        COMPROBANTE_PAGO = "COMPROBANTE_PAGO", _("Comprobante de Pago Electrónico")

    class Status(models.TextChoices):
        # Ciclo del documento (ADR-0084). Borrador = folio pendiente; el pago es otro eje
        # (`payment_status`, derivado del saldo).
        DRAFT = "DRAFT", _("Borrador")
        POSTED = "POSTED", _("Emitida")
        CANCELLED = "CANCELLED", _("Anulado")

    class PaymentMethod(models.TextChoices):
        CASH = "CASH", _("Efectivo")
        CARD = "CARD", _("Tarjeta")
        TRANSFER = "TRANSFER", _("Transferencia")
        CHECK = "CHECK", _("Cheque")
        CREDIT = "CREDIT", _("Crédito")
        CREDIT_BALANCE = "CREDIT_BALANCE", _("Saldo a Favor")

    # number: redeclarado — Invoice usa folio sin unique global (mismo folio en distintos dte_type es válido)
    number = models.CharField(_("Folio"), max_length=20, blank=True)
    # status: redeclarado con DTEType-aware choices (POSTED en lugar de CONFIRMED)
    status = models.CharField(
        _("Estado"), max_length=20, choices=Status.choices, default=Status.DRAFT
    )
    # journal_entry: redeclarado para exponer reverso 'invoice' (el abstracto usa '+')
    journal_entry = models.OneToOneField(
        JournalEntry,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="invoice",
    )

    dte_type = models.CharField(_("Tipo DTE"), max_length=25, choices=DTEType.choices)
    sii_document_code = models.IntegerField(
        _("Código SII"),
        null=True,
        blank=True,
        choices=[
            (33, "Factura Electrónica"),
            (34, "Factura Exenta"),
            (39, "Boleta Electrónica"),
            (41, "Boleta Exenta"),
            (48, "Comprobante de Pago Electrónico"),
            (56, "Nota de Débito"),
            (61, "Nota de Crédito"),
        ],
        help_text=_("Código oficial del tipo de DTE según SII de Chile"),
    )
    document_attachment = models.FileField(
        _("Adjunto de Documento"),
        upload_to=generic_upload_path("invoices/"),
        storage=PrivateMediaStorage(),
        null=True,
        blank=True,
        validators=[validate_file_size, validate_file_extension],
    )
    date = models.DateField(_("Fecha"), default=get_current_date)

    # Links (GFK)
    source_content_type = models.ForeignKey(
        ContentType, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    source_object_id = models.PositiveIntegerField(null=True, blank=True)
    source_order = GenericForeignKey("source_content_type", "source_object_id")

    # Legacy Links
    sale_order = models.ForeignKey(
        SaleOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name="invoices"
    )
    purchase_order = models.ForeignKey(
        PurchaseOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name="invoices"
    )
    corrected_invoice = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="adjustments",
        verbose_name=_("Factura Rectificada"),
        help_text=_("Documento original que esta nota rectifica"),
    )
    contact = models.ForeignKey(
        "contacts.Contact",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="invoices",
        verbose_name=_("Contacto"),
    )

    # Fiscal snapshot of the counterparty taken when the document is issued, so
    # later edits to the contact do not rewrite issued documents (ADR-0091 §10).
    partner_name_snapshot = models.CharField(_("Razón social (al emitir)"), max_length=255, blank=True)
    partner_tax_id_snapshot = models.CharField(_("RUT (al emitir)"), max_length=20, blank=True)
    partner_address_snapshot = models.TextField(_("Dirección (al emitir)"), blank=True)

    payment_method = models.CharField(
        _("Método de Pago"),
        max_length=20,
        choices=PaymentMethod.choices,
        default=PaymentMethod.CREDIT,
    )
    attachments = GenericRelation("core.Attachment")

    # Totals (inherited: total_net, total_tax, total — max_digits=14, decimal_places=0)
    total_discount_amount = models.DecimalField(
        _("Monto Descuento Total"), max_digits=14, decimal_places=0, default=0
    )

    # Tax Period Control
    tax_period_closed = models.BooleanField(
        _("Período Cerrado"),
        default=False,
        help_text=_("Indica si el período tributario de este documento está cerrado"),
    )

    class Meta:
        verbose_name = _("Factura/Boleta")
        verbose_name_plural = _("Facturas y Boletas")

    def __str__(self):
        return self.display_id

    SNAPSHOT_FIELDS = ("partner_name_snapshot", "partner_tax_id_snapshot", "partner_address_snapshot")

    @property
    def partner(self):
        if self.sale_order_id and self.sale_order.customer_id:
            return self.sale_order.customer
        if self.purchase_order_id and self.purchase_order.supplier_id:
            return self.purchase_order.supplier
        return self.contact

    @property
    def has_fiscal_snapshot(self) -> bool:
        return bool(self.partner_tax_id_snapshot or self.partner_name_snapshot)

    def capture_fiscal_snapshot(self) -> None:
        partner = self.partner
        if partner is None:
            return
        self.partner_name_snapshot = partner.name or ""
        self.partner_tax_id_snapshot = partner.tax_id or ""
        self.partner_address_snapshot = partner.address or ""

    @property
    def partner_display_name(self) -> str:
        if self.has_fiscal_snapshot:
            return self.partner_name_snapshot
        partner = self.partner
        return partner.name if partner else ""

    @property
    def partner_display_tax_id(self) -> str:
        if self.has_fiscal_snapshot:
            return self.partner_tax_id_snapshot
        partner = self.partner
        return (partner.tax_id or "") if partner else ""

    def save(self, *args, **kwargs):
        if self.status == self.Status.POSTED and not self.has_fiscal_snapshot:
            self.capture_fiscal_snapshot()
            update_fields = kwargs.get("update_fields")
            if update_fields is not None:
                kwargs["update_fields"] = set(update_fields) | set(self.SNAPSHOT_FIELDS)
        super().save(*args, **kwargs)

    def dte_strategy(self):
        """Devuelve la estrategia DTE correspondiente a este documento."""
        from billing.strategies.dte import get_dte_strategy

        return get_dte_strategy(self.dte_type)

    @property
    def sii_code(self) -> int:
        """Retorna el código SII numérico del documento"""
        if self.sii_document_code:
            return self.sii_document_code

        try:
            return self.dte_strategy().sii_document_code
        except KeyError:
            return 0

    @property
    def is_tax_exempt(self) -> bool:
        """Indica si el documento está exento de IVA"""
        return self.dte_type in [self.DTEType.FACTURA_EXENTA, self.DTEType.BOLETA_EXENTA]

    @property
    def display_id(self):
        """Retorna ID del documento con prefijo apropiado"""
        from core.prefix_registry import EntityPrefix
        try:
            prefix = self.dte_strategy().display_prefix
        except KeyError:
            prefix = EntityPrefix.INVOICE_FACTURA
        # FACTURA se usa para ventas y compras: FACV para venta, FACC para compra
        if self.dte_type == self.DTEType.FACTURA and self.purchase_order_id:
            prefix = EntityPrefix.INVOICE_COMPRA
        return f"{prefix}-{self.number or 'Draft'}"

    @property
    def total_paid(self):
        """Calculates the total amount paid for this invoice"""
        from treasury.selectors import PaymentSelector

        return PaymentSelector.paid_amount(
            self.payments.all(),
            sale_side=self.is_sale_document(),
            allocations=self.payment_allocations.all(),
            fk_remainder=True,
        )

    @property
    def pending_amount(self):
        """Calculates the remaining amount to be paid for this invoice"""
        return self.total - self.total_paid

    @property
    def payment_status(self):
        """Eje de pago (ADR-0084): UNPAID · PARTIAL · PAID, derivado del saldo."""
        from core.payment_status import payment_status_for

        return payment_status_for(self.total, self.total_paid)

    # --- T-57 ampliado: Polymorphic treasury hooks ---

    @property
    def order(self):
        """
        Orden origen de la factura vía FK tipadas (GAP-05, auditoría documental).
        Reemplaza al GFK `source_order`, que ningún flujo escribe.
        """
        return self.sale_order or self.purchase_order

    def is_sale_document(self) -> bool:
        """
        Indica si la factura corresponde a una venta.
        Falso si está ligada a una OC o es factura de compra; las standalone son de venta.
        """
        return self.purchase_order_id is None and self.dte_type != self.DTEType.PURCHASE_INV

    def get_customer_for_payment(self):
        """
        Retorna el contacto cliente para resolver la cuenta contable en el pago.
        Prioriza el customer de la OV origen sobre el contact de la factura.
        """
        if self.sale_order_id:
            return self.sale_order.customer
        return self.contact

    class FormMeta:
        ui_layout = {
            "tabs": [
                {
                    "id": "main",
                    "label": "General",
                    "fields": [
                        "dte_type",
                        "status",
                        "date",
                        "contact",
                        "payment_method",
                        "sii_document_code",
                        "document_attachment",
                        "corrected_invoice",
                        "total_net",
                        "total_tax",
                        "total_discount_amount",
                        "total",
                    ],
                }
            ]
        }
        field_config = {
            "sii_document_code": {
                "visible_if": {
                    "field": "dte_type",
                    "in": [
                        "FACTURA",
                        "FACTURA_EXENTA",
                        "BOLETA",
                        "BOLETA_EXENTA",
                        "NOTA_CREDITO",
                        "NOTA_DEBITO",
                    ],
                }
            },
            "document_attachment": {
                "visible_if": {
                    "field": "dte_type",
                    "in": [
                        "FACTURA",
                        "FACTURA_EXENTA",
                        "BOLETA",
                        "BOLETA_EXENTA",
                        "NOTA_CREDITO",
                        "NOTA_DEBITO",
                    ],
                }
            },
            "corrected_invoice": {
                "visible_if": {"field": "dte_type", "in": ["NOTA_CREDITO", "NOTA_DEBITO"]}
            },
        }


class InvoiceLine(models.Model):
    """
    Línea propia de una factura (ADR-0081, GAP-13). Factura ↔ orden es N:M derivada de
    estas líneas (`sale_line.order` / `purchase_line.order`); facturación parcial por
    cantidad atada a la entrega (decisiones D1.1, D1.2).
    """

    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="lines")
    sale_line = models.ForeignKey(
        "sales.SaleLine", on_delete=models.PROTECT, null=True, blank=True, related_name="invoice_lines"
    )
    purchase_line = models.ForeignKey(
        "purchasing.PurchaseLine", on_delete=models.PROTECT, null=True, blank=True, related_name="invoice_lines"
    )
    delivery_line = models.ForeignKey(
        "sales.SaleDeliveryLine", on_delete=models.PROTECT, null=True, blank=True, related_name="invoice_lines"
    )
    receipt_line = models.ForeignKey(
        "purchasing.PurchaseReceiptLine", on_delete=models.PROTECT, null=True, blank=True,
        related_name="invoice_lines",
    )
    # NC/ND: línea de factura que corrige (D1.3, GAP-14 — etapa M4c)
    corrected_line = models.ForeignKey(
        "self", on_delete=models.PROTECT, null=True, blank=True, related_name="note_lines"
    )
    product = models.ForeignKey(
        "inventory.Product", on_delete=models.PROTECT, null=True, blank=True, related_name="invoice_lines"
    )
    description = models.CharField(_("Descripción"), max_length=255, blank=True)
    quantity = models.DecimalField(_("Cantidad"), max_digits=10, decimal_places=2)
    uom = models.ForeignKey("inventory.UoM", on_delete=models.PROTECT, null=True, blank=True)
    unit_price = models.DecimalField(_("Precio Unitario Neto"), max_digits=12, decimal_places=2, default=0)
    unit_price_gross = models.DecimalField(
        _("Precio Unitario Bruto"), max_digits=12, decimal_places=2, null=True, blank=True
    )
    tax_rate = models.DecimalField(_("Tasa Impuesto"), max_digits=5, decimal_places=2, default=0)
    discount_amount = models.DecimalField(_("Descuento"), max_digits=12, decimal_places=0, default=0)
    # Misma semántica que la línea de orden que factura (bruto si hay precio bruto).
    subtotal = models.DecimalField(_("Subtotal"), max_digits=12, decimal_places=0, default=0)

    class Meta:
        verbose_name = _("Línea de Factura")
        verbose_name_plural = _("Líneas de Factura")
        ordering = ["id"]

    @property
    def order_line(self):
        return self.sale_line or self.purchase_line


# NoteWorkflow vive en su propio módulo; se importa aquí para que Django lo registre al
# cargar la app (sin esto, con --nomigrations la tabla solo existía si otro módulo lo
# importaba antes de crear la BD de test → "no such table" según el orden de los tests).
from .note_workflow import NoteWorkflow  # noqa: E402, F401
