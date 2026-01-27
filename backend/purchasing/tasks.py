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
        # 1. DUPLICATE/SAFETY CHECK
        # Avoid generating multiple orders for the same period.
        # We check if there's any PO for this supplier & product created in the last 20 days.
        # (Assuming monthly frequency as default roughly, 20 days is a safe buffer to not dup)
        cutoff_date = today - timezone.timedelta(days=20)
        
        # Look for existing orders (Draft or Confirmed) that contain this subscription's product
        duplicate_exists = PurchaseOrder.objects.filter(
            supplier=sub.supplier,
            lines__product=sub.product,
            date__gte=cutoff_date
        ).exclude(status=PurchaseOrder.Status.CANCELLED).exists()
        
        if duplicate_exists:
            print(f"Skipping Subscription {sub.id}: Order already exists recently.")
            continue

        # 2. CALCULATE NEXT DATE
        from inventory.subscription_service import SubscriptionService
        new_next_date = SubscriptionService.calculate_next_payment_date(sub)
        
        product = sub.product
        
        # 3. WAREHOUSE LOGIC (Optional for Services)
        warehouse_id = None
        if sub.product.receiving_warehouse:
            warehouse_id = sub.product.receiving_warehouse.id
        # Note: We NO LONGER force a default warehouse if product doesn't have one.
        
        # 4. VARIABLE AMOUNT LOGIC
        # If product has variable amount (e.g. Electricity bill), we cannot know the cost.
        # Set cost to 0 (or 1 as placeholder?) and keep as DRAFT.
        is_variable = product.is_variable_amount
        
        estimated_cost = sub.amount if not is_variable else 0
        if estimated_cost is None: 
            estimated_cost = 0

        # Create Purchase Order with metadata
        order_data = {
            'supplier': sub.supplier.id,
            'warehouse': warehouse_id, 
            'date': today,
            'notes': f"renovación automática de suscripción #{sub.id} para el periodo {sub.next_payment_date}",
            'currency': sub.currency,
            'lines': [
                {
                    'product': sub.product.id,
                    'quantity': 1,
                    'unit_cost': round(estimated_cost, 0),
                    'tax_rate': 0, # Should fetch from product taxes ideally
                }
            ]
        }
        
        serializer = WritePurchaseOrderSerializer(data=order_data)
        if serializer.is_valid():
            order = serializer.save()
            
            # Metadata notes
            metadata_note = f"\n[METADATA] subscription_id={sub.id}"
            if product.default_invoice_type:
                metadata_note += f", invoice_type={product.default_invoice_type}"
            
            order.notes = (order.notes or "") + metadata_note
            order.save()
            
            # 5. AUTO-CONFIRMATION LOGIC
            # Only auto-confirm if it's NOT a variable amount order.
            # Variable amounts need manual input of the actual bill value.
            if not is_variable:
                try:
                    order.status = PurchaseOrder.Status.CONFIRMED
                    order.save()
                    print(f"Auto-confirmed Order {order.number} for Subscription {sub.id}")
                except Exception as e:
                    print(f"Failed to auto-confirm Order {order.number}: {str(e)}")
            else:
                print(f"Created DRAFT Order {order.number} for Variable Subscription {sub.id}")
            
            # Update Subscription
            sub.next_payment_date = new_next_date
            sub.save()
            
            generated_count += 1
            print(f"Generated Order {order.number} for Subscription {sub.id}")
        else:
            print(f"Failed to generate order for Subscription {sub.id}: {serializer.errors}")


    return f"Se han creado {generated_count} órdenes de compra asociadas a suscripciones."
