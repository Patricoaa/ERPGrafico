from django.db import models
from django.utils import timezone
from core.utils import get_current_date
from django.contrib.contenttypes.fields import GenericRelation
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator
from simple_history.models import HistoricalRecords
from sales.models import SaleOrder
from inventory.models import Product, Warehouse, UoM

class WorkOrder(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', _('Borrador')
        IN_PROGRESS = 'IN_PROGRESS', _('En Proceso')
        FINISHED = 'FINISHED', _('Terminada')
        CANCELLED = 'CANCELLED', _('Anulada')

    class Stage(models.TextChoices):
        MATERIAL_ASSIGNMENT = 'MATERIAL_ASSIGNMENT', _('Asignación de Materiales')
        MATERIAL_APPROVAL = 'MATERIAL_APPROVAL', _('Aprobación de Stock')
        OUTSOURCING_ASSIGNMENT = 'OUTSOURCING_ASSIGNMENT', _('Asignación de Tercerizados')
        PREPRESS = 'PREPRESS', _('Pre-Impresión')
        PRESS = 'PRESS', _('Impresión')
        POSTPRESS = 'POSTPRESS', _('Post-Impresión')
        OUTSOURCING_VERIFICATION = 'OUTSOURCING_VERIFICATION', _('Verificación de Tercerizados')
        RECTIFICATION = 'RECTIFICATION', _('Rectificación')
        FINISHED = 'FINISHED', _('Finalizada')
        CANCELLED = 'CANCELLED', _('Cancelada')

    number = models.CharField(_("Número OT"), max_length=20, unique=True, editable=False)
    description = models.CharField(_("Descripción"), max_length=255)
    
    sale_order = models.ForeignKey(
        SaleOrder, 
        on_delete=models.SET_NULL, 
        null=True, blank=True, 
        related_name='work_orders',
        help_text="Nota de Venta asociada"
    )
    
    sale_line = models.ForeignKey(
        'sales.SaleLine',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='work_orders',
        help_text="Línea de venta asociada"
    )
    
    related_note = models.ForeignKey(
        'billing.Invoice',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='work_orders',
        help_text="Nota de Débito/Crédito que originó esta OT"
    )
    
    related_contact = models.ForeignKey(
        'contacts.Contact',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='related_work_orders',
        verbose_name=_("Contacto Relacionado"),
        help_text="Contacto relacionado con esta OT (ej: cliente del cliente, dato de facturación)"
    )
    
    # New fields for manual OT
    is_manual = models.BooleanField(_("Es Manual"), default=False)
    product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='manual_work_orders',
        help_text="Producto fabricable (para OTs manuales)"
    )
    
    status = models.CharField(_("Estado"), max_length=20, choices=Status.choices, default=Status.DRAFT)
    
    current_stage = models.CharField(
        _("Etapa Actual"),
        max_length=30,
        choices=Stage.choices,
        default=Stage.MATERIAL_ASSIGNMENT
    )
    
    # Store dynamic data for each stage
    stage_data = models.JSONField(
        _("Datos de Etapas"),
        default=dict,
        blank=True,
        help_text="Datos de diseño, folios, confirmaciones de impresión, etc."
    )
    
    warehouse = models.ForeignKey(
        Warehouse, 
        on_delete=models.PROTECT, 
        related_name='work_orders',
        null=True, blank=True,
        help_text="Bodega de donde se obtendrán los materiales"
    )
    
    # Specs
    specifications = models.TextField(_("Especificaciones Técnicas"), blank=True, help_text="Papel, Tintas, Terminaciones, etc.")

    estimated_completion_date = models.DateField(_("Fecha Estimada de Finalización"), null=True, blank=True)
    start_date = models.DateField(_("Fecha de Inicio"), null=True, blank=True)

    # Rectification fields
    actual_quantity_produced = models.DecimalField(
        _("Cantidad Real Producida"),
        max_digits=12,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Cantidad real fabricada declarada en la rectificación (OTs manuales)"
    )
    is_rectified = models.BooleanField(
        _("Rectificada"),
        default=False,
        help_text="Indica si la OT pasó por el paso de rectificación antes de finalizar"
    )

    attachments = GenericRelation('core.Attachment')
    history = HistoricalRecords()

    no_materials_required = models.BooleanField(_("Sin materiales de stock"), default=False, help_text="Si se marca, se omite el paso de aprobación de materiales")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("Orden de Trabajo")
        verbose_name_plural = _("Ordenes de Trabajo")
        ordering = ['-id']

    def __str__(self):
        return f"{self.display_id} {self.description}"
    
    @property
    def display_id(self):
        return f"OT-{self.number}"
    
    @property
    def product_info(self):
        """
        Returns product information if associated with a sale line or manual product.
        """
        if self.sale_line and self.sale_line.product:
            product = self.sale_line.product
            return {
                'id': product.id,
                'code': product.internal_code or product.code,
                'name': product.name,
                'quantity': float(self.sale_line.quantity),
                'unit_price': float(self.sale_line.unit_price),
            }
        elif self.is_manual and self.product:
            return {
                'id': self.product.id,
                'code': self.product.internal_code or self.product.code,
                'name': self.product.name,
                'quantity': float(self.stage_data.get('quantity', 0)),
                'unit_price': 0,
            }
        return None
    
    @property
    def requires_prepress(self):
        # 1. Try stage_data (specific for this order)
        if isinstance(self.stage_data, dict) and 'phases' in self.stage_data:
            return self.stage_data['phases'].get('prepress', False)
        # 2. Fallback to product default
        product = self.product or (self.sale_line.product if self.sale_line else None)
        if product:
            return product.mfg_enable_prepress
        return False

    @property
    def requires_press(self):
        if isinstance(self.stage_data, dict) and 'phases' in self.stage_data:
            return self.stage_data['phases'].get('press', False)
        product = self.product or (self.sale_line.product if self.sale_line else None)
        if product:
            return product.mfg_enable_press
        return False

    @property
    def requires_postpress(self):
        if isinstance(self.stage_data, dict) and 'phases' in self.stage_data:
            return self.stage_data['phases'].get('postpress', False)
        product = self.product or (self.sale_line.product if self.sale_line else None)
        if product:
            return product.mfg_enable_postpress
        return False

    @property
    def cancellation_limit_stage(self):
        """
        Determines the limit stage for cancellation.
        Default is PRESS if available, else the previous one (PREPRESS or MATERIAL_APPROVAL).
        """
        if self.requires_press:
            return self.Stage.PRESS
        if self.requires_prepress:
            return self.Stage.PREPRESS
        return self.Stage.MATERIAL_APPROVAL

    @property
    def is_cancellable(self):
        """
        Returns True if the Work Order can be cancelled based on its current stage.
        """
        STAGES_SEQUENCE = [
            self.Stage.MATERIAL_ASSIGNMENT,
            self.Stage.MATERIAL_APPROVAL,
            self.Stage.OUTSOURCING_ASSIGNMENT,
            self.Stage.PREPRESS,
            self.Stage.PRESS,
            self.Stage.POSTPRESS,
            self.Stage.OUTSOURCING_VERIFICATION,
            self.Stage.RECTIFICATION,
            self.Stage.FINISHED
        ]
        
        limit_stage = self.cancellation_limit_stage
        try:
            current_idx = STAGES_SEQUENCE.index(self.current_stage)
            limit_idx = STAGES_SEQUENCE.index(limit_stage)
            return current_idx <= limit_idx
        except ValueError:
            return False

    @property
    def canonical_stage_data(self) -> dict:
        """TASK-112: Return stage_data normalized to v1 canonical shape.

        Migrates legacy nested documents (prepress/press/postpress sub-dicts) to
        the flat v1 layout on-the-fly. Does NOT persist the normalized data —
        call .save() explicitly if you want to persist after migration.
        """
        from .stage_data_schema import migrate_stage_data_to_v1
        return migrate_stage_data_to_v1(self.stage_data or {})


    def save(self, *args, **kwargs):
        if not self.number:
            from django.db import transaction
            with transaction.atomic():
                last_order = WorkOrder.objects.select_for_update().order_by('-id').first()
                if last_order and last_order.number and last_order.number.isdigit():
                    self.number = str(int(last_order.number) + 1).zfill(6)
                else:
                    self.number = '000001'
        
        # Sync related_contact from stage_data['contact_id'] if present
        # This ensures OTs created via the checkout flow or manual wizard are correctly linked
        if self.stage_data and isinstance(self.stage_data, dict):
            contact_id = self.stage_data.get('contact_id')
            if contact_id:
                from contacts.models import Contact
                try:
                    # Only update if different to avoid unnecessary work
                    if not self.related_contact_id or self.related_contact_id != int(contact_id):
                        self.related_contact_id = int(contact_id)
                except (Contact.DoesNotExist, ValueError, TypeError):
                    pass

        super().save(*args, **kwargs)

class ProductionConsumption(models.Model):
    """
    Records material consumption for a Work Order.
    Triggers Stock OUT.
    """
    work_order = models.ForeignKey(WorkOrder, on_delete=models.CASCADE, related_name='consumptions')
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='production_usages')
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name='production_usages')
    quantity = models.DecimalField(_("Cantidad"), max_digits=12, decimal_places=4, validators=[MinValueValidator(0)])
    
    date = models.DateField(_("Fecha"), default=get_current_date)
    
    # Link to Stock Move
    stock_move = models.OneToOneField(
        'inventory.StockMove',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='production_consumption'
    )

    class Meta:
        verbose_name = _("Consumo Material")
        verbose_name_plural = _("Consumos Materiales")
        ordering = ['-id']

    def __str__(self):
        return f"{self.product.name} x {self.quantity} (OT-{self.work_order.number})"

class WorkOrderMaterial(models.Model):
    """
    Materiales asignados a una OT específica.
    Permite asignar materiales directamente a la OT sin necesidad de un BOM maestro.
    """
    work_order = models.ForeignKey(WorkOrder, on_delete=models.CASCADE, related_name='materials')
    component = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='ot_material_usages')
    quantity_planned = models.DecimalField(_("Cantidad Planificada"), max_digits=12, decimal_places=4, validators=[MinValueValidator(0)])
    quantity_consumed = models.DecimalField(_("Cantidad Consumida"), max_digits=12, decimal_places=4, default=0, validators=[MinValueValidator(0)])
    uom = models.ForeignKey(UoM, on_delete=models.PROTECT, related_name='ot_materials')
    
    # Field to track if this came from a BOM or was added manually
    source = models.CharField(
        _("Origen"), 
        max_length=20, 
        choices=[('BOM', 'Lista de Materiales'), ('MANUAL', 'Manual')], 
    )
    
    # Outsourcing fields
    is_outsourced = models.BooleanField(_("Es Tercerizado"), default=False)
    supplier = models.ForeignKey(
        'contacts.Contact', 
        on_delete=models.SET_NULL, 
        null=True, blank=True, 
        related_name='work_order_materials',
        verbose_name=_("Proveedor")
    )
    unit_price = models.DecimalField(_("Precio Unitario OC"), max_digits=12, decimal_places=0, default=0, validators=[MinValueValidator(0)])
    purchase_line = models.ForeignKey(
        'purchasing.PurchaseLine', 
        on_delete=models.SET_NULL, 
        null=True, blank=True, 
        related_name='work_order_materials',
        verbose_name=_("Línea de Compra")
    )
    
    document_type = models.CharField(
        _("Tipo de Documento"),
        max_length=20,
        choices=[('FACTURA', 'Factura'), ('BOLETA', 'Boleta')],
        default='FACTURA'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("Material de OT")
        verbose_name_plural = _("Materiales de OT")
        unique_together = [['work_order', 'component']]

    def __str__(self):
        return f"{self.component.name} ({self.work_order.number})"

class WorkOrderHistory(models.Model):
    """
    Track history of stage changes and important actions.
    """
    work_order = models.ForeignKey(WorkOrder, on_delete=models.CASCADE, related_name='stage_history')
    stage = models.CharField(max_length=30)
    status = models.CharField(max_length=20)
    notes = models.TextField(blank=True)
    user = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = _("Historial de OT")
        verbose_name_plural = _("Historiales de OT")

class BillOfMaterials(models.Model):
    """
    Lista de materiales para productos fabricables.
    Define qué materiales se necesitan para producir 1 unidad del producto.
    """
    product = models.ForeignKey(
        Product, 
        on_delete=models.CASCADE, 
        related_name='boms',
        limit_choices_to={'product_type': 'MANUFACTURABLE'},
        help_text="Producto fabricable"
    )
    name = models.CharField(_("Nombre"), max_length=255, help_text="Ej: BOM Camiseta Roja v1")
    active = models.BooleanField(_("Activo"), default=True, help_text="Solo puede haber un BOM activo por producto")
    
    yield_quantity = models.DecimalField(
        _("Rendimiento"), 
        max_digits=12, 
        decimal_places=4,
        default=1,
        validators=[MinValueValidator(0.0001)],
        help_text="Cantidad producida por esta receta"
    )
    yield_uom = models.ForeignKey(
        UoM, 
        on_delete=models.SET_NULL, 
        related_name='bom_yields',
        verbose_name=_("Unidad de Rendimiento"),
        null=True, blank=True,
        help_text="Unidad en la que se expresa el rendimiento (se usa la unidad base del producto si se omite)"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("Lista de Materiales (BOM)")
        verbose_name_plural = _("Listas de Materiales (BOMs)")
        ordering = ['-id']

    def __str__(self):
        status = "✓" if self.active else "✗"
        yield_str = f" ({self.yield_quantity} {self.yield_uom.name if self.yield_uom else ''})".strip() if self.yield_quantity != 1 else ""
        return f"{status} {self.name}{yield_str} - {self.product.name}"
    
    def save(self, *args, **kwargs):
        # If this BOM is being set as active, deactivate other BOMs for the same product
        if self.active:
            BillOfMaterials.objects.filter(product=self.product, active=True).exclude(pk=self.pk).update(active=False)
            
            # Sync product has_bom flag
            if not self.product.has_bom:
                self.product.has_bom = True
                self.product.save(update_fields=['has_bom'])
                
        super().save(*args, **kwargs)
    
    @classmethod
    def get_active_bom_for_product(cls, product):
        """Get the active BOM for a product (including variants)."""
        return cls.objects.filter(product=product, active=True).first()

class BillOfMaterialsLine(models.Model):
    """
    Línea individual de la lista de materiales.
    Especifica un componente necesario para fabricar el producto.
    """
    bom = models.ForeignKey(BillOfMaterials, on_delete=models.CASCADE, related_name='lines')
    component = models.ForeignKey(
        Product, 
        on_delete=models.PROTECT, 
        related_name='used_in_boms',
        help_text="Producto componente/material"
    )
    quantity = models.DecimalField(
        _("Cantidad"), 
        max_digits=12, 
        decimal_places=4,
        validators=[MinValueValidator(0)],
        help_text="Cantidad necesaria por unidad producida"
    )
    uom = models.ForeignKey(
        UoM, 
        on_delete=models.PROTECT, 
        related_name='bom_lines',
        verbose_name=_("Unidad de Medida"),
        null=True, blank=True
    )
    
    # Outsourcing fields (for outsourced service lines)
    is_outsourced = models.BooleanField(_("Es Tercerizado"), default=False)
    supplier = models.ForeignKey(
        'contacts.Contact',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='bom_lines',
        verbose_name=_("Proveedor")
    )
    unit_price = models.DecimalField(
        _("Precio Unitario Neto"),
        max_digits=12,
        decimal_places=0,
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Precio neto por unidad (sin IVA)"
    )
    document_type = models.CharField(
        _("Tipo de Documento"),
        max_length=20,
        choices=[('FACTURA', 'Factura'), ('BOLETA', 'Boleta')],
        default='FACTURA'
    )
    
    sequence = models.IntegerField(_("Secuencia"), default=10, help_text="Orden de visualización")

    class Meta:
        verbose_name = _("Línea de BOM")
        verbose_name_plural = _("Líneas de BOM")
        ordering = ['sequence', 'id']
        unique_together = [['bom', 'component']]

    def __str__(self):
        return f"{self.component.code} x {self.quantity} {self.uom.name if self.uom else ''}"
