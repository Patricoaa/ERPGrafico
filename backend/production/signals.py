from django.db.models.signals import post_save
from django.dispatch import receiver
from sales.models import SaleOrder, SaleLine
from .services import WorkOrderService
from inventory.models import Product

@receiver(post_save, sender=SaleOrder)
def auto_create_work_orders(sender, instance, created, **kwargs):
    """
    When a SaleOrder is confirmed, create Work Orders for manufacturable lines.
    """
    if instance.status == SaleOrder.Status.CONFIRMED:
        for line in instance.lines.all():
            if line.product and line.product.product_type == Product.Type.MANUFACTURABLE:
                # Check if OT already exists to avoid duplicates if saved multiple times in confirmed state
                if not line.work_orders.exists():
                    WorkOrderService.create_from_sale_line(line)
