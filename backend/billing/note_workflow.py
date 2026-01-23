from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.exceptions import ValidationError
from decimal import Decimal


class NoteWorkflow(models.Model):
    """
    Workflow tracker for Credit/Debit Notes created from HUB with multi-stage checkout.
    Replaces the atomic create_note approach with a staged process similar to sales/purchase checkouts.
    """
    
    class Stage(models.TextChoices):
        DRAFT = 'DRAFT', _('Borrador')
        INVOICE_SELECTED = 'INVOICE_SELECTED', _('Factura Seleccionada')
        ITEMS_SELECTED = 'ITEMS_SELECTED', _('Productos Seleccionados')
        LOGISTICS_PENDING = 'LOGISTICS_PENDING', _('Logística Pendiente')
        LOGISTICS_COMPLETED = 'LOGISTICS_COMPLETED', _('Logística Completada')
        REGISTRATION_PENDING = 'REGISTRATION_PENDING', _('Registro Pendiente')
        PAYMENT_PENDING = 'PAYMENT_PENDING', _('Pago Pendiente')
        COMPLETED = 'COMPLETED', _('Completado')
        CANCELLED = 'CANCELLED', _('Cancelado')
    
    # Main invoice document (the NC/ND being created)
    invoice = models.OneToOneField(
        'billing.Invoice',
        on_delete=models.CASCADE,
        related_name='workflow',
        verbose_name=_("Nota de Crédito/Débito")
    )
    
    # Workflow state
    current_stage = models.CharField(
        _("Etapa Actual"),
        max_length=30,
        choices=Stage.choices,
        default=Stage.DRAFT
    )
    
    # Original invoice being corrected/adjusted
    corrected_invoice = models.ForeignKey(
        'billing.Invoice',
        on_delete=models.PROTECT,
        related_name='correction_workflows',
        verbose_name=_("Factura Original"),
        help_text=_("Factura POSTED que se está corrigiendo con esta nota")
    )
    
    # Order references (for easier navigation)
    sale_order = models.ForeignKey(
        'sales.SaleOrder',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='note_workflows'
    )
    purchase_order = models.ForeignKey(
        'purchasing.PurchaseOrder',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='note_workflows'
    )
    
    # Workflow configuration
    requires_logistics = models.BooleanField(
        _("Requiere Logística"),
        default=False,
        help_text=_("True si hay productos stockeables que generan movimientos de inventario")
    )
    
    registration_deferred = models.BooleanField(
        _("Registro Diferido"),
        default=False,
        help_text=_("True si el usuario eligió atrasar el registro contable")
    )
    
    # Stage data (JSON fields to store stage-specific information)
    selected_items = models.JSONField(
        _("Productos Seleccionados"),
        null=True,
        blank=True,
        help_text=_("Lista de productos a devolver/ajustar: [{product_id, quantity, reason, unit_price, tax_amount}]")
    )
    
    logistics_data = models.JSONField(
        _("Datos de Logística"),
        null=True,
        blank=True,
        help_text=_("Información de bodega, fecha, notas: {warehouse_id, date, notes}")
    )
    
    registration_data = models.JSONField(
        _("Datos de Facturación"),
        null=True,
        blank=True,
        help_text=_("Información de DTE: {dte_type, document_number, date}")
    )
    
    payment_data = models.JSONField(
        _("Datos de Pago"),
        null=True,
        blank=True,
        help_text=_("Información de pago/ajuste: {method, amount, account_id, apply_credit}")
    )
    
    # Metadata
    reason = models.TextField(
        _("Motivo"),
        blank=True,
        help_text=_("Razón de la creación de esta nota")
    )
    
    notes = models.TextField(
        _("Notas Internas"),
        blank=True
    )
    
    created_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_note_workflows',
        verbose_name=_("Creado Por")
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = _("Workflow de Nota")
        verbose_name_plural = _("Workflows de Notas")
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Workflow {self.id} - {self.invoice.display_id} ({self.get_current_stage_display()})"
    
    def clean(self):
        """Validation rules"""
        # Validate corrected invoice is POSTED or PAID
        if self.corrected_invoice_id:
            if self.corrected_invoice.status not in ['POSTED', 'PAID']:
                raise ValidationError({
                    'corrected_invoice': _("Solo se pueden crear NC/ND desde facturas publicadas o pagadas.")
                })
            
            # Cannot create note from another note
            if self.corrected_invoice.dte_type in ['NOTA_CREDITO', 'NOTA_DEBITO']:
                raise ValidationError({
                    'corrected_invoice': _("No se puede crear una nota desde otra nota. Seleccione la factura original.")
                })
    
    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
    
    @property
    def is_credit_note(self):
        """Helper to check if this is a credit note workflow"""
        return self.invoice.dte_type == 'NOTA_CREDITO'
    
    @property
    def is_debit_note(self):
        """Helper to check if this is a debit note workflow"""
        return self.invoice.dte_type == 'NOTA_DEBITO'
    
    @property
    def can_advance(self):
        """Check if workflow can advance to next stage"""
        stage_requirements = {
            self.Stage.DRAFT: lambda: self.corrected_invoice_id is not None,
            self.Stage.INVOICE_SELECTED: lambda: self.selected_items is not None and len(self.selected_items) > 0,
            self.Stage.ITEMS_SELECTED: lambda: not self.requires_logistics or self.logistics_data is not None,
            self.Stage.LOGISTICS_COMPLETED: lambda: self.registration_data is not None,
            self.Stage.REGISTRATION_PENDING: lambda: self.payment_data is not None,
        }
        
        return stage_requirements.get(self.current_stage, lambda: True)()
    
    @property
    def total_items(self):
        """Count of selected items"""
        return len(self.selected_items) if self.selected_items else 0
    
    @property
    def has_stockable_items(self):
        """Check if any selected items are stockable"""
        if not self.selected_items:
            return False
        
        from inventory.models import Product
        
        for item in self.selected_items:
            product = Product.objects.filter(id=item.get('product_id')).first()
            if product and product.track_inventory:
                # Exclude manufacturable without BOM or advanced
                if product.product_type == 'MANUFACTURABLE':
                    if product.requires_advanced_manufacturing or not product.has_bom:
                        continue
                return True
        
        return False
