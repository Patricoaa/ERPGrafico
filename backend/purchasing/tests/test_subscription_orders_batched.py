"""generate_subscription_orders: duplicados en una sola consulta y tope por ejecución."""

from datetime import date
from decimal import Decimal
from unittest import mock

import pytest
from django.utils import timezone

from contacts.models import Contact
from inventory.models import Product, ProductCategory, Subscription, UoM, UoMCategory
from purchasing import tasks as purchasing_tasks
from purchasing.models import PurchaseOrder


@pytest.fixture
def subscriptions(db):
    uom = UoM.objects.create(name="Unidad", category=UoMCategory.objects.create(name="Unit"), uom_type="REFERENCE")
    category = ProductCategory.objects.create(name="Suscripciones")
    supplier = Contact.objects.create(name="Proveedor suscripcion", tax_id="SUB-1")
    today = timezone.now().date()

    def make(i):
        product = Product.objects.create(
            name=f"Servicio {i}", category=category, uom=uom, sale_uom=uom, purchase_uom=uom,
            product_type="SERVICE", sale_price=Decimal("100"),
        )
        return Subscription.objects.create(
            product=product, supplier=supplier, start_date=date(2026, 1, 1),
            next_payment_date=today, amount=Decimal("100"), status=Subscription.Status.ACTIVE,
        )

    return [make(i) for i in range(3)]


def _existing_order_for(sub, status=PurchaseOrder.Status.DRAFT):
    marker = f"subscription_id={sub.id}, period_date={sub.next_payment_date.isoformat()}"
    return PurchaseOrder.objects.create(supplier=sub.supplier, status=status, notes=f"[METADATA] {marker}")


@pytest.fixture
def serializer():
    with mock.patch.object(purchasing_tasks, "WritePurchaseOrderSerializer") as ser:
        ser.return_value.is_valid.return_value = False  # no real order: we only observe which subs were attempted
        yield ser


@pytest.mark.django_db
def test_subscription_with_existing_order_for_period_is_skipped(subscriptions, serializer):
    _existing_order_for(subscriptions[0])

    purchasing_tasks.generate_subscription_orders()

    attempted = [c.kwargs["data"]["notes"] for c in serializer.call_args_list]
    assert len(attempted) == 2
    assert not any(f"subscription_id={subscriptions[0].id}," in note for note in attempted)


@pytest.mark.django_db
def test_cancelled_order_does_not_block_renewal(subscriptions, serializer):
    _existing_order_for(subscriptions[0], status=PurchaseOrder.Status.CANCELLED)

    purchasing_tasks.generate_subscription_orders()

    assert serializer.call_count == 3


@pytest.mark.django_db
def test_run_is_capped_per_execution(subscriptions, serializer):
    with mock.patch.object(purchasing_tasks, "MAX_SUBSCRIPTIONS_PER_RUN", 2):
        purchasing_tasks.generate_subscription_orders()

    assert serializer.call_count == 2


@pytest.mark.django_db
def test_duplicate_check_is_one_query_per_run(subscriptions, serializer):
    from django.db import connection
    from django.test.utils import CaptureQueriesContext

    with CaptureQueriesContext(connection) as ctx:
        purchasing_tasks.generate_subscription_orders()

    po_reads = [q for q in ctx.captured_queries if '"purchasing_purchaseorder"' in q["sql"] and "SELECT" in q["sql"][:10]]
    assert len(po_reads) == 1
