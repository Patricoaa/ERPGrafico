from django.db import models
from django.utils.translation import gettext_lazy as _
from django.contrib.contenttypes.fields import GenericRelation
from django.utils import timezone
from accounting.models import JournalEntry
from sales.models import SaleOrder
from purchasing.models import PurchaseOrder
from simple_history.models import HistoricalRecords
from core.validators import validate_file_size, validate_file_extension
from core.utils import generic_upload_path
from .note_workflow import NoteWorkflow  # Import workflow model

class Invoice(models.Model):
    class DTEType(models.TextChoices):
        FACTURA = 'FACTURA', _('Factura Electrónica')
        FACTURA_EXENTA = 'FACTURA_EXENTA', _('Factura No Afecta o Exenta')
        BOLETA = 'BOLETA', _('Boleta Electrónica')
        BOLETA_EXENTA = 'BOLETA_EXENTA', _('Boleta No Afecta o Exenta')
        PURCHASE_INV = 'PURCHASE_INV', _('Factura de Compra')
        NOTA_CREDITO = 'NOTA_CREDITO', _('Nota de Crédito')
        NOTA_DEBITO = 'NOTA_DEBITO', _('Nota de Débito')

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
            (56, 'Nota de Débito'),
            (61, 'Nota de Crédito'),
        ],
        help_text=_("Código oficial del tipo de DTE según SII de Chile")
    )
    number = models.CharField(_("Folio"), max_length=20, blank=True)
    document_attachment = models.FileField(
        _("Adjunto de Documento"), 
        upload_to=generic_upload_path('invoices/'), 
        null=True, blank=True,
        validators=[validate_file_size, validate_file_extension]
    )
    date = models.DateField(_("Fecha"), default=timezone.now)
    
    # Links
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
    
    status = models.CharField(_("Estado"), max_length=20, choices=Status.choices, default=Status.DRAFT)
    payment_method = models.CharField(_("Método de Pago"), max_length=20, choices=PaymentMethod.choices, default=PaymentMethod.CREDIT)
    attachments = GenericRelation('core.Attachment')

    # Totals
    total_net = models.DecimalField(_("Neto"), max_digits=12, decimal_places=0, default=0)
    total_tax = models.DecimalField(_("Impuesto"), max_digits=12, decimal_places=0, default=0)
    total = models.DecimalField(_("Total"), max_digits=12, decimal_places=0, default=0)

    # Accounting
    journal_entry = models.OneToOneField(
        JournalEntry,
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='invoice'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Factura/Boleta")
        verbose_name_plural = _("Facturas y Boletas")
        ordering = ['-id']

    def __str__(self):
        return self.display_id

    @property
    def sii_code(self) -> int:
        """Retorna el código SII numérico del documento"""
        if self.sii_document_code:
            return self.sii_document_code
        
        # Fallback para documentos antiguos sin código asignado
        code_map = {
            'FACTURA': 33,
            'FACTURA_EXENTA': 34,
            'BOLETA': 39,
            'BOLETA_EXENTA': 41,
            'NOTA_DEBITO': 56,
            'NOTA_CREDITO': 61,
            'PURCHASE_INV': 33,  # Asumir factura afecta por defecto
        }
        return code_map.get(self.dte_type, 0)
    
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
        prefix = 'FACT'
        if self.dte_type == 'NOTA_CREDITO': prefix = 'NC'
        elif self.dte_type == 'NOTA_DEBITO': prefix = 'ND'
        elif self.dte_type == 'BOLETA': prefix = 'BOL'
        elif self.dte_type == 'BOLETA_EXENTA': prefix = 'BOL-EX'
        elif self.dte_type == 'FACTURA_EXENTA': prefix = 'FACT-EX'
        return f"{prefix}-{self.number or 'Draft'}"
