from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import StockMove
from .services import ProcurementService

@receiver(post_save, sender=StockMove)
def trigger_replenishment_check(sender, instance, created, **kwargs):
    """
    Triggers a replenishment check whenever a stock move is recorded.
    Specifically important for OUT and ADJ (negative) moves.
    """
    if instance.product.track_inventory:
         ProcurementService.check_replenishment(instance.product, instance.warehouse)
