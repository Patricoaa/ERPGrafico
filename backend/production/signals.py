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
            product = line.product
            if product and product.product_type == Product.Type.MANUFACTURABLE and product.has_bom:
                # ONLY create OT if Express or Advanced manufacturing is enabled.
                # If both are OFF (Simple mode), we assume manual/batch production.
                if product.mfg_auto_finalize or product.requires_advanced_manufacturing:
                    # Check if OT already exists to avoid duplicates
                    if not line.work_orders.exists():
                        WorkOrderService.create_from_sale_line(line)
