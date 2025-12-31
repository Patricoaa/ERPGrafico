from django.db import models
from django.utils.translation import gettext_lazy as _
from sales.models import SaleOrder
from inventory.models import Product, Warehouse

class WorkOrder(models.Model):
    class Status(models.TextChoices):
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
    
    status = models.CharField(_("Estado"), max_length=20, choices=Status.choices, default=Status.PLANNED)
    
    # Specs
    specifications = models.TextField(_("Especificaciones Técnicas"), blank=True, help_text="Papel, Tintas, Terminaciones, etc.")
    qty_planned = models.IntegerField(_("Cantidad Planificada"), default=0)
    qty_produced = models.IntegerField(_("Cantidad Producida"), default=0)

    start_date = models.DateField(_("Fecha Inicio"), null=True, blank=True)
    due_date = models.DateField(_("Fecha Entrega"), null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("Orden de Trabajo")
        verbose_name_plural = _("Ordenes de Trabajo")

    def __str__(self):
        return f"OT-{self.number} {self.description}"
    
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
