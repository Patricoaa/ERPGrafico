from celery import shared_task
from django.utils import timezone
from dateutil.relativedelta import relativedelta
from inventory.models import Subscription, Product
from purchasing.models import PurchaseOrder, PurchaseLine
from purchasing.serializers import WritePurchaseOrderSerializer

@shared_task
def generate_subscription_orders():
    """
    Generates draft purchase orders for active subscriptions that are due for renewal.
    Runs daily.
    """
    today = timezone.now().date()
    # Look for subscriptions due in the next 7 days or past due
    upcoming_subscriptions = Subscription.objects.filter(
        status=Subscription.Status.ACTIVE,
        next_payment_date__lte=today + timezone.timedelta(days=7)
    )

    generated_count = 0

    for sub in upcoming_subscriptions:
        # Check if we already have a draft order for this subscription/date
        # This is a basic check; might need robust logic to prevent dupes
        # We check if there is a DRAFT order for this supplier created recently (e.g. last 7 days)
        # that contains this product.
        # Ideally, Subscription model tracks 'last_generated_order_date'
        
        # Calculate new next_payment_date based on recurrence
        # But we don't update subscription yet; we update it when the new order is CONFIRMED/PAID?
        # OR we generate the order and move the date forward?
        # Standard practice: Generate the order, and assume it covers the period starting at 'next_payment_date'.
        # We need to advance 'next_payment_date' to avoid generating it again tomorrow.
        
        # Calculate next period
        next_date = sub.next_payment_date
        if not next_date:
            next_date = today

        # Frequency mapping
        recurrence_map = {
            Product.RecurrencePeriod.MONTHLY: relativedelta(months=1),
            Product.RecurrencePeriod.QUARTERLY: relativedelta(months=3),
            Product.RecurrencePeriod.ANNUAL: relativedelta(years=1),
        }
        delta = recurrence_map.get(sub.recurrence_period, relativedelta(months=1))
        
        new_next_date = next_date + delta
        
        # Create Purchase Order
        order_data = {
            'supplier': sub.supplier.id,
            'warehouse': sub.product.category.warehouse.id if hasattr(sub.product.category, 'warehouse') and sub.product.category.warehouse else None, 
            'date': today,
            'notes': f"Renovación automática de suscripción #{sub.id} para el periodo {next_date}",
            'currency': sub.currency,
            'lines': [
                {
                    'product': sub.product.id,
                    'quantity': 1,
                    'unit_cost': round(sub.amount, 0), # Serializer uses unit_cost, not price
                    'tax_rate': 0, # Defaulting to 0 for now
                }
            ]
        }
        
        serializer = WritePurchaseOrderSerializer(data=order_data)
        if serializer.is_valid():
            order = serializer.save()
            
            # Update Subscription
            sub.next_payment_date = new_next_date
            sub.save()
            
            generated_count += 1
            print(f"Generated Order {order.number} for Subscription {sub.id}")
        else:
            print(f"Failed to generate order for Subscription {sub.id}: {serializer.errors}")

    return f"Generated {generated_count} subscription orders."
