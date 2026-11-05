import logging
from functools import reduce
from operator import or_

from celery import shared_task
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from inventory.models import Subscription
from purchasing.models import PurchaseOrder
from purchasing.serializers import WritePurchaseOrderSerializer
from workflow.models import Notification

logger = logging.getLogger(__name__)

# Cota por ejecución (Big O: sin tope, una corrida procesaba todas las suscripciones vencidas).
MAX_SUBSCRIPTIONS_PER_RUN = 500


@shared_task(
    bind=True, autoretry_for=(Exception,), retry_kwargs={"max_retries": 3}, retry_backoff=True
)
def generate_subscription_orders(self):
    """
    Generates draft purchase orders for active subscriptions that are due for renewal.
    Runs daily.
    """
    today = timezone.now().date()
    # Look for subscriptions due in the next 7 days or past due. Bounded per run: the rest is
    # picked up by the next run (next_payment_date stays due until its order is paid).
    upcoming_subscriptions = list(
        Subscription.objects.filter(
            status=Subscription.Status.ACTIVE,
            next_payment_date__lte=today + timezone.timedelta(days=7),
        )
        .select_related("product", "product__receiving_warehouse", "supplier")
        .order_by("next_payment_date", "id")[:MAX_SUBSCRIPTIONS_PER_RUN]
    )
    if len(upcoming_subscriptions) == MAX_SUBSCRIPTIONS_PER_RUN:
        logger.warning(
            f"generate_subscription_orders: run capped at {MAX_SUBSCRIPTIONS_PER_RUN} subscriptions."
        )

    # DUPLICATE/SAFETY CHECK, batched: one query for the period markers of this run instead of
    # one LIKE scan per subscription. An order with the marker already exists (unless cancelled),
    # so the subscription is skipped for that period.
    markers = {
        sub.id: f"subscription_id={sub.id}, period_date={sub.next_payment_date.isoformat()}"
        for sub in upcoming_subscriptions
    }
    existing_notes = []
    if markers:
        marker_filter = reduce(or_, (Q(notes__contains=m) for m in markers.values()))
        existing_notes = list(
            PurchaseOrder.objects.filter(marker_filter)
            .exclude(status=PurchaseOrder.Status.CANCELLED)
            .values_list("notes", flat=True)
        )
    already_ordered = {
        sub_id for sub_id, marker in markers.items() if any(marker in notes for notes in existing_notes)
    }

    generated_count = 0

    for sub in upcoming_subscriptions:
        try:
            with transaction.atomic():
                if sub.id in already_ordered:
                    logger.info(
                        f"Skipping Subscription {sub.id}: Order for period {sub.next_payment_date} already exists."
                    )
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
                    "supplier": sub.supplier.id,
                    "warehouse": warehouse_id,
                    "date": today,
                    "notes": f"renovación automática de suscripción #{sub.id} para el periodo {sub.next_payment_date}",
                    "currency": sub.currency,
                    "lines": [
                        {
                            "product": sub.product.id,
                            "quantity": 1,
                            "unit_cost": round(estimated_cost, 0),
                            "tax_rate": 0,  # Should fetch from product taxes ideally
                        }
                    ],
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
                            logger.info(
                                f"Auto-confirmed Order {order.number} for Subscription {sub.id}"
                            )

                            # Ensure workflow tasks are created
                            try:
                                from workflow.services import WorkflowService

                                WorkflowService.sync_hub_tasks(order)
                            except Exception as e:
                                logger.error(
                                    f"Failed to sync hub tasks for Order {order.number}: {str(e)}"
                                )

                            # Notify configured recipients about the new order
                            WorkflowService.send_notification(
                                notification_type="SUBSCRIPTION_OC_CREATED",
                                title=f"Nueva Orden de Suscripción: {order.display_id}",
                                message=f"Proveedor: {order.supplier.name if order.supplier else 'N/A'}",
                                level=Notification.Type.INFO,
                                link=f"/purchasing/dtes/orders?selected={order.id}",
                                content_object=order,
                            )
                        except Exception as e:
                            logger.error(f"Failed to auto-confirm Order {order.number}: {str(e)}")
                    else:
                        logger.info(
                            f"Created DRAFT Order {order.number} for Variable Subscription {sub.id}"
                        )
                        # Create the origin task for the draft OC
                        try:
                            from workflow.services import WorkflowService

                            WorkflowService.create_draft_purchase_order_task(order)
                        except Exception as e:
                            logger.error(
                                f"Failed to create draft task for Order {order.number}: {str(e)}"
                            )

                    # CRITICAL: We NO LONGER update sub.next_payment_date here.
                    # It will be updated in PurchaseOrder.save() when status becomes PAID.

                    generated_count += 1
                    logger.info(f"Generated Order {order.number} for Subscription {sub.id}")
                else:
                    logger.error(
                        f"Failed to generate order for Subscription {sub.id}: {serializer.errors}"
                    )

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
