from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from .models import StockMove, Product, Subscription
from .services import ProcurementService
import logging

logger = logging.getLogger(__name__)

@receiver(post_save, sender=StockMove)
def trigger_replenishment_check(sender, instance, created, **kwargs):
    """
    Triggers a replenishment check whenever a stock move is recorded.
    Specifically important for OUT and ADJ (negative) moves.
    """
    if instance.product.track_inventory:
         ProcurementService.check_replenishment(instance.product, instance.warehouse)


@receiver(post_save, sender=Product)
def auto_activate_subscription(sender, instance, created, **kwargs):
    """
    Automatically creates a Subscription record when a SUBSCRIPTION product is saved with:
    - auto_activate_subscription = True
    - subscription_supplier is set
    - subscription_amount is set
    
    Only creates if no active subscription exists for this product + supplier combination.
    """
    # Only process SUBSCRIPTION products
    if instance.product_type != Product.Type.SUBSCRIPTION:
        return
    
    # Only if auto-activation is enabled
    if not instance.auto_activate_subscription:
        return
    
    # Require supplier and amount (amount can be 0 if variable)
    if not instance.subscription_supplier or (not instance.is_variable_amount and not instance.subscription_amount):
        logger.warning(
            f"Product {instance.id} has auto_activate_subscription=True but missing supplier or fixed amount"
        )
        return
    
    # Check if subscription already exists
    existing = Subscription.objects.filter(
        product=instance,
        supplier=instance.subscription_supplier,
        status=Subscription.Status.ACTIVE
    ).exists()
    
    if existing:
        logger.info(f"Active subscription already exists for product {instance.id}")
        return
    
    # Determine start date
    start_date = instance.subscription_start_date or timezone.now().date()
    
    # Create subscription
    from .subscription_service import SubscriptionService
    
    subscription = Subscription.objects.create(
        product=instance,
        supplier=instance.subscription_supplier,
        start_date=start_date,
        next_payment_date=start_date,  # Temporary, will be calculated below
        amount=instance.subscription_amount or 0,
        currency='CLP',
        status=Subscription.Status.ACTIVE,
        recurrence_period=instance.recurrence_period or Product.RecurrencePeriod.MONTHLY,
        notes="Activada automáticamente desde configuración de producto"
    )
    
    # Calculate next_payment_date correctly
    subscription.next_payment_date = SubscriptionService.calculate_next_payment_date(
        subscription,
        from_date=start_date
    )
    
    # Set end date if not indefinite
    if not instance.is_indefinite and instance.contract_end_date:
        subscription.end_date = instance.contract_end_date
    
    subscription.save()
    
    logger.info(
        f"Auto-created subscription {subscription.id} for product {instance.id} "
        f"with supplier {instance.subscription_supplier.id}"
    )
