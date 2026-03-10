import logging
from celery import shared_task
from django.utils import timezone
from django.db import transaction
from dateutil.relativedelta import relativedelta
from inventory.models import Subscription, Product
from purchasing.models import PurchaseOrder, PurchaseLine
from purchasing.serializers import WritePurchaseOrderSerializer
from workflow.models import Notification
from core.models import User

logger = logging.getLogger(__name__)

@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_kwargs={'max_retries': 3},
    retry_backoff=True
)
def generate_subscription_orders(self):
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
        try:
            with transaction.atomic():
                # 1. DUPLICATE/SAFETY CHECK
                # We check if there's any PO that already contains the subscription metadata for this specific period.
                # This prevents creating multiple orders if the current one is still unpaid or in draft.
                period_marker = f"subscription_id={sub.id}, period_date={sub.next_payment_date.isoformat()}"
                
                duplicate_exists = PurchaseOrder.objects.filter(
                    notes__contains=period_marker
                ).exclude(status=PurchaseOrder.Status.CANCELLED).exists()
                
                if duplicate_exists:
                    logger.info(f"Skipping Subscription {sub.id}: Order for period {sub.next_payment_date} already exists.")
                    continue

                product = sub.product
                
                # 2. WAREHOUSE LOGIC (Optional for Services)
                warehouse_id = None
                if sub.product.receiving_warehouse:
                    warehouse_id = sub.product.receiving_warehouse.id
                
                # 3. VARIABLE AMOUNT LOGIC
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
                    
                    # 4. METADATA PERSISTENCE
                    # We include the period_date to robustly track duplicates and advance the subscription only when THIS PO is paid.
                    metadata_note = f"\n[METADATA] subscription_id={sub.id}, period_date={sub.next_payment_date.isoformat()}"
                    if product.default_invoice_type:
                        metadata_note += f", invoice_type={product.default_invoice_type}"
                    
                    order.notes = (order.notes or "") + metadata_note
                    order.save()
                    
                    # 5. AUTO-CONFIRMATION LOGIC
                    if not is_variable:
                        try:
                            order.status = PurchaseOrder.Status.CONFIRMED
                            order.save()
                            logger.info(f"Auto-confirmed Order {order.number} for Subscription {sub.id}")

                            # Ensure workflow tasks are created
                            try:
                                from workflow.services import WorkflowService
                                WorkflowService.sync_hub_tasks(order)
                            except Exception as e:
                                logger.error(f"Failed to sync hub tasks for Order {order.number}: {str(e)}")
                            
                            # Notify superusers about the new order
                            superusers = User.objects.filter(is_superuser=True)
                            # Notify configured recipients about the new order
                            WorkflowService.send_notification(
                                notification_type='SUBSCRIPTION_OC_CREATED',
                                title=f"Nueva Orden de Suscripción: OC-{order.number}",
                                message=f"Proveedor: {order.supplier.name if order.supplier else 'N/A'}",
                                level=Notification.Type.INFO,
                                link=f"/purchasing/orders?openHub={order.id}",
                                content_object=order
                            )
                        except Exception as e:
                            logger.error(f"Failed to auto-confirm Order {order.number}: {str(e)}")
                    else:
                        logger.info(f"Created DRAFT Order {order.number} for Variable Subscription {sub.id}")
                        # Create the origin task for the draft OC
                        try:
                            from workflow.services import WorkflowService
                            WorkflowService.create_draft_purchase_order_task(order)
                        except Exception as e:
                            logger.error(f"Failed to create draft task for Order {order.number}: {str(e)}")
                    
                    # CRITICAL: We NO LONGER update sub.next_payment_date here.
                    # It will be updated in PurchaseOrder.save() when status becomes PAID.
                    
                    generated_count += 1
                    logger.info(f"Generated Order {order.number} for Subscription {sub.id}")
                else:
                    logger.error(f"Failed to generate order for Subscription {sub.id}: {serializer.errors}")

        except Exception as e:
            logger.error(f"Error processing Subscription {sub.id}: {str(e)}", exc_info=True)
            # We don't re-raise here to allow the loop to continue with other subscriptions.
            # If a massive failure occurs (e.g. lost DB connection), Celery's autoretry will catch it in the outer block or next run.
            # Actually, to trigger autoretry on DB failure, we might want to re-raise if it's an operational error.
            # For simplicity, we assume individual data validation errors are caught here safely.
            from django.db import OperationalError
            if isinstance(e, OperationalError):
                raise e

    return f"Se han creado {generated_count} órdenes de compra asociadas a suscripciones."
