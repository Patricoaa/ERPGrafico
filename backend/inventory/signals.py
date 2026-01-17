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
def product_subscription_sync(sender, instance, created, **kwargs):
    """
    Handles both creation and updates for SUBSCRIPTION products:
    1. Creation: Auto-activates subscription if enabled.
    2. Update: Synchronizes changes to all associated ACTIVE subscriptions.
    """
    if instance.product_type != Product.Type.SUBSCRIPTION:
        return

    from .subscription_service import SubscriptionService

    if created:
        # --- CREATION LOGIC ---
        if not instance.auto_activate_subscription:
            return

        if not instance.subscription_supplier or (not instance.is_variable_amount and not instance.subscription_amount):
            logger.warning(f"Product {instance.id} missing supplier or amount for auto-activation")
            return

        start_date = instance.subscription_start_date or timezone.now().date()
        
        subscription = Subscription.objects.create(
            product=instance,
            supplier=instance.subscription_supplier,
            start_date=start_date,
            next_payment_date=start_date, # Temp
            amount=instance.subscription_amount or 0,
            currency='CLP',
            status=Subscription.Status.ACTIVE,
            recurrence_period=instance.recurrence_period or Product.RecurrencePeriod.MONTHLY,
            notes="Activada automáticamente desde configuración de producto"
        )
        
        subscription.next_payment_date = SubscriptionService.calculate_next_payment_date(subscription, from_date=start_date)
        if not instance.is_indefinite and instance.contract_end_date:
            subscription.end_date = instance.contract_end_date
        subscription.save()
        
        logger.info(f"Auto-created subscription {subscription.id}")

    else:
        # --- UPDATE/SYNC LOGIC ---
        active_subs = Subscription.objects.filter(product=instance, status=Subscription.Status.ACTIVE)
        
        if active_subs.exists():
            for sub in active_subs:
                # Update core financial fields
                sub.amount = instance.subscription_amount or 0
                sub.recurrence_period = instance.recurrence_period or Product.RecurrencePeriod.MONTHLY
                sub.end_date = instance.contract_end_date if not instance.is_indefinite else None
                
                # Align next payment date with new configuration
                SubscriptionService.align_next_payment_date(sub)
                sub.save()
            
            logger.info(f"Synchronized {active_subs.count()} active subscriptions for product {instance.id}")
