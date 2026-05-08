from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.utils import timezone
from .models import StockMove, Product, Subscription
import logging

logger = logging.getLogger(__name__)

@receiver(pre_save, sender=Product)
def product_pre_save(sender, instance, **kwargs):
    """
    Store the old cost_price to detect changes after save.
    """
    if instance.pk:
        try:
            old_instance = Product.objects.get(pk=instance.pk)
            instance._old_cost_price = old_instance.cost_price
            instance._old_sale_price = old_instance.sale_price
        except Product.DoesNotExist:
            instance._old_cost_price = None
            instance._old_sale_price = None
    else:
        instance._old_cost_price = None
        instance._old_sale_price = None

@receiver(post_save, sender=Product)
def product_post_save(sender, instance, created, **kwargs):
    """
    Handles side effects of product updates:
    1. Synchronize subscriptions.
    2. Check for low margin if cost price changed.
    """
    # 1. Low Margin Check
    # Only if the cost price or sale price has actually changed (or it's a new product with cost/sale price)
    old_cost = getattr(instance, '_old_cost_price', None)
    old_sale = getattr(instance, '_old_sale_price', None)
    
    cost_changed = (created and instance.cost_price > 0) or (not created and old_cost != instance.cost_price)
    sale_changed = (created and instance.sale_price > 0) or (not created and old_sale != instance.sale_price)
    
    if cost_changed or sale_changed:
        try:
            from .tasks import check_product_margin_task
            # Delay the task to run asynchronously
            check_product_margin_task.delay(instance.id)
        except Exception as e:
            logger.error(f"Failed to queue margin check for product {instance.id}: {e}")

@receiver(post_save, sender=StockMove)
def handle_stock_move_updates(sender, instance, created, **kwargs):
    """
    Handles side effects of stock movements:
    1. Resets unit cost to 0 if stock is zero (requested by business rule).
    2. Invalidates report cache (T-24).
    """
    from core.cache import invalidate_report_cache
    invalidate_report_cache('inventory')

    product = instance.product
    if not product.track_inventory:
        return

    # 1. Reset Cost if stock reached zero or less
    # Note: We check physical stock (qty_on_hand)
    if product.qty_on_hand <= 0 and product.cost_price != 0:
        product.cost_price = 0
        product.save(update_fields=['cost_price'])

from django.db.models.signals import post_delete
@receiver(post_delete, sender=StockMove)
def handle_stock_move_delete(sender, instance, **kwargs):
    from core.cache import invalidate_report_cache
    invalidate_report_cache('inventory')


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
