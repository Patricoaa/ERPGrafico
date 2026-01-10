from django.db import models
from django.utils.translation import gettext_lazy as _
from sales.models import SaleOrder
from inventory.models import Product, Warehouse, UoM

class WorkOrder(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', _('Borrador')
        PLANNED = 'PLANNED', _('Planificada')
        IN_PROGRESS = 'IN_PROGRESS', _('En Proceso')
        FINISHED = 'FINISHED', _('Terminada')
        CANCELLED = 'CANCELLED', _('Anulada')

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
    
    status = models.CharField(_("Estado"), max_length=20, choices=Status.choices, default=Status.DRAFT)
    
    # Specs
    specifications = models.TextField(_("Especificaciones Técnicas"), blank=True, help_text="Papel, Tintas, Terminaciones, etc.")

    estimated_completion_date = models.DateField(_("Fecha Estimada de Finalización"), null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("Orden de Trabajo")
        verbose_name_plural = _("Ordenes de Trabajo")

    def __str__(self):
        return f"OT-{self.number} {self.description}"
    
    @property
    def product_info(self):
        """
        Returns product information if associated with a sale line.
        """
        if self.sale_line and self.sale_line.product:
            product = self.sale_line.product
            return {
                'code': product.code,
                'name': product.name,
                'quantity': float(self.sale_line.quantity),
                'unit_price': float(self.sale_line.unit_price),
            }
        return None
    
    def save(self, *args, **kwargs):
        if not self.number:
            last_order = WorkOrder.objects.all().order_by('id').last()
            if last_order and last_order.number.isdigit():
                self.number = str(int(last_order.number) + 1).zfill(6)
            else:
                self.number = '000001'
        super().save(*args, **kwargs)

class ProductionConsumption(models.Model):
    """
    Records material consumption for a Work Order.
    Triggers Stock OUT.
    """
    work_order = models.ForeignKey(WorkOrder, on_delete=models.CASCADE, related_name='consumptions')
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='production_usages')
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name='production_usages')
    quantity = models.DecimalField(_("Cantidad"), max_digits=12, decimal_places=4)
    
    date = models.DateField(_("Fecha"), auto_now_add=True)
    
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

    def __str__(self):
        return f"{self.product.name} x {self.quantity} (OT-{self.work_order.number})"

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
    notes = models.TextField(_("Notas"), blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("Lista de Materiales (BOM)")
        verbose_name_plural = _("Listas de Materiales (BOMs)")
        ordering = ['-active', '-created_at']

    def __str__(self):
        status = "✓" if self.active else "✗"
        return f"{status} {self.name} - {self.product.name}"
    
    def save(self, *args, **kwargs):
        # If this BOM is being set as active, deactivate other BOMs for the same product
        if self.active:
            BillOfMaterials.objects.filter(product=self.product, active=True).exclude(pk=self.pk).update(active=False)
            
            # Sync product has_bom flag
            if not self.product.has_bom:
                self.product.has_bom = True
                self.product.save(update_fields=['has_bom'])
                
        super().save(*args, **kwargs)

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
        help_text="Cantidad necesaria por unidad producida"
    )
    uom = models.ForeignKey(
        UoM, 
        on_delete=models.PROTECT, 
        related_name='bom_lines',
        verbose_name=_("Unidad de Medida"),
        null=True, blank=True
    )
    notes = models.TextField(_("Notas"), blank=True)
    
    sequence = models.IntegerField(_("Secuencia"), default=10, help_text="Orden de visualización")

    class Meta:
        verbose_name = _("Línea de BOM")
        verbose_name_plural = _("Líneas de BOM")
        ordering = ['sequence', 'id']
        unique_together = [['bom', 'component']]

    def __str__(self):
        return f"{self.component.code} x {self.quantity} {self.uom.name if self.uom else ''}"
