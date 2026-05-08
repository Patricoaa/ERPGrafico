from django.db import models
from django.utils.translation import gettext_lazy as _
from django.contrib.contenttypes.fields import GenericRelation, GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
from accounting.models import JournalEntry
from sales.models import SaleOrder
from purchasing.models import PurchaseOrder
from core.validators import validate_file_size, validate_file_extension
from core.utils import generic_upload_path, get_current_date
from core.storages import PrivateMediaStorage
from core.models import TransactionalDocument
from .note_workflow import NoteWorkflow  # Import workflow model

class Invoice(TransactionalDocument):
    class DTEType(models.TextChoices):
        FACTURA = 'FACTURA', _('Factura Electrónica')
        FACTURA_EXENTA = 'FACTURA_EXENTA', _('Factura No Afecta o Exenta')
        BOLETA = 'BOLETA', _('Boleta Electrónica')
        BOLETA_EXENTA = 'BOLETA_EXENTA', _('Boleta No Afecta o Exenta')
        PURCHASE_INV = 'PURCHASE_INV', _('Factura de Compra')
        NOTA_CREDITO = 'NOTA_CREDITO', _('Nota de Crédito')
        NOTA_DEBITO = 'NOTA_DEBITO', _('Nota de Débito')
        COMPROBANTE_PAGO = 'COMPROBANTE_PAGO', _('Comprobante de Pago Electrónico')

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', _('Borrador')
        POSTED = 'POSTED', _('Publicado')
        PAID = 'PAID', _('Pagado')
        CANCELLED = 'CANCELLED', _('Anulado')

    class PaymentMethod(models.TextChoices):
        CASH = 'CASH', _('Efectivo')
        CARD = 'CARD', _('Tarjeta')
        TRANSFER = 'TRANSFER', _('Transferencia')
        CREDIT = 'CREDIT', _('Crédito')
        CREDIT_BALANCE = 'CREDIT_BALANCE', _('Saldo a Favor')

    # number: redeclarado — Invoice usa folio sin unique global (mismo folio en distintos dte_type es válido)
    number = models.CharField(_("Folio"), max_length=20, blank=True)
    # status: redeclarado con DTEType-aware choices (POSTED en lugar de CONFIRMED)
    status = models.CharField(_("Estado"), max_length=20, choices=Status.choices, default=Status.DRAFT)
    # journal_entry: redeclarado para exponer reverso 'invoice' (el abstracto usa '+')
    journal_entry = models.OneToOneField(
        JournalEntry,
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='invoice',
    )

    dte_type = models.CharField(_("Tipo DTE"), max_length=25, choices=DTEType.choices)
    sii_document_code = models.IntegerField(
        _("Código SII"),
        null=True,
        blank=True,
        choices=[
            (33, 'Factura Electrónica'),
            (34, 'Factura Exenta'),
            (39, 'Boleta Electrónica'),
            (41, 'Boleta Exenta'),
            (48, 'Comprobante de Pago Electrónico'),
            (56, 'Nota de Débito'),
            (61, 'Nota de Crédito'),
        ],
        help_text=_("Código oficial del tipo de DTE según SII de Chile")
    )
    document_attachment = models.FileField(
        _("Adjunto de Documento"),
        upload_to=generic_upload_path('invoices/'),
        storage=PrivateMediaStorage(),
        null=True, blank=True,
        validators=[validate_file_size, validate_file_extension]
    )
    date = models.DateField(_("Fecha"), default=get_current_date)

    # Links (GFK)
    source_content_type = models.ForeignKey(
        ContentType, null=True, blank=True, on_delete=models.SET_NULL, related_name='+'
    )
    source_object_id = models.PositiveIntegerField(null=True, blank=True)
    source_order = GenericForeignKey('source_content_type', 'source_object_id')

    # Legacy Links
    sale_order = models.ForeignKey(SaleOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    corrected_invoice = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='adjustments',
        verbose_name=_("Factura Rectificada"),
        help_text=_("Documento original que esta nota rectifica")
    )
    contact = models.ForeignKey('contacts.Contact', on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices', verbose_name=_("Contacto"))

    payment_method = models.CharField(_("Método de Pago"), max_length=20, choices=PaymentMethod.choices, default=PaymentMethod.CREDIT)
    attachments = GenericRelation('core.Attachment')

    # Totals (inherited: total_net, total_tax, total — max_digits=14, decimal_places=0)
    total_discount_amount = models.DecimalField(_("Monto Descuento Total"), max_digits=14, decimal_places=0, default=0)

    # Tax Period Control
    tax_period_closed = models.BooleanField(
        _("Período Cerrado"),
        default=False,
        help_text=_("Indica si el período tributario de este documento está cerrado")
    )

    class Meta:
        verbose_name = _("Factura/Boleta")
        verbose_name_plural = _("Facturas y Boletas")

    def __str__(self):
        return self.display_id

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
        return self.dte_type in [
            self.DTEType.FACTURA_EXENTA,
            self.DTEType.BOLETA_EXENTA
        ]
    
    @property
    def display_id(self):
        """Retorna ID del documento con prefijo apropiado"""
        try:
            prefix = self.dte_strategy().display_prefix
        except KeyError:
            prefix = 'DOC'
        return f"{prefix}-{self.number or 'Draft'}"

    @property
    def total_paid(self):
        """Calculates the total amount paid for this invoice"""
        from treasury.models import TreasuryMovement
        return sum(
            p.amount for p in self.payments.all()
            if p.status != TreasuryMovement.Status.CANCELLED
        )

    @property
    def pending_amount(self):
        """Calculates the remaining amount to be paid for this invoice"""
        return self.total - self.total_paid
