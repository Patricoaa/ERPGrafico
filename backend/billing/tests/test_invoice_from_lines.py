"""
M4b (ADR-0081) — escenarios D6 de facturación parcial y multi-orden por cantidad.
"""

import uuid
from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from rest_framework.test import APIClient

from accounting.models import Account, AccountingSettings, AccountType
from billing.invoice_from_lines import InvoiceFromLinesService
from billing.invoicing import InvoicingService
from billing.models import Invoice
from billing.services import BillingService
from contacts.models import Contact
from inventory.models import Location, Product, ProductCategory, UoM, UoMCategory, Warehouse
from sales.models import SaleDelivery, SaleDeliveryLine, SaleLine, SaleOrder
from sales.services import SalesService
from treasury.models import PaymentAllocation, TreasuryAccount, TreasuryMovement
from treasury.services import TreasuryService

FACTURA = Invoice.DTEType.FACTURA


@pytest.fixture(autouse=True)
def _any_account_is_cash(monkeypatch):
    # Igual que core/treasury tests: evita exigir la jerarquía del plan de cuentas para la caja
    monkeypatch.setattr(Account, "get_cash_pool_accounts", classmethod(lambda cls: cls.objects.all()))


@pytest.fixture
def env(db):
    def acc(code, name, kind):
        return Account.objects.create(code=code, name=name, account_type=kind)

    settings = AccountingSettings.get_solo()
    settings.default_receivable_account = acc("1.1.03.082", "Clientes", AccountType.ASSET)
    settings.default_revenue_account = acc("4.1.01.082", "Ventas", AccountType.INCOME)
    settings.default_tax_payable_account = acc("2.1.05.082", "IVA Débito", AccountType.LIABILITY)
    settings.default_advance_payment_account = acc("2.1.07.082", "Anticipos de clientes", AccountType.LIABILITY)
    settings.save()

    uom_cat, _ = UoMCategory.objects.get_or_create(name="Unidades")
    uom, _ = UoM.objects.get_or_create(name="unidad", defaults={"ratio": 1, "category": uom_cat})
    cat, _ = ProductCategory.objects.get_or_create(name="Test", defaults={"prefix": "TST"})
    storable = Product.objects.create(name="Afiche", internal_code="AFI-82", product_type=Product.Type.STORABLE,
                                      uom=uom, category=cat, cost_price=Decimal("0"))
    service = Product.objects.create(name="Diseño", internal_code="DIS-82", product_type=Product.Type.SERVICE,
                                     uom=uom, category=cat, cost_price=Decimal("0"))
    warehouse = Warehouse.objects.create(name="Bodega", code="WH-82")
    Location.objects.get_or_create(location_type="INTERNAL", warehouse=warehouse, defaults={"name": "Interno"})
    Location.objects.get_or_create(location_type="CUSTOMER", defaults={"name": "Cliente"})
    cash_acc = acc("1.1.01.082", "Caja", AccountType.ASSET)
    cash = TreasuryAccount.objects.create(name="Caja", account=cash_acc, account_type=TreasuryAccount.Type.CASH)
    return {
        "uom": uom, "storable": storable, "service": service, "warehouse": warehouse, "cash": cash,
        "customer": Contact.objects.create(name="Imprenta Norte", tax_id="12345678-9"),
        "other": Contact.objects.create(name="Otra Imprenta", tax_id="98765432-1"),
    }


def _order(env, product, qty, price="1190", customer=None):
    order = SaleOrder.objects.create(customer=customer or env["customer"], date=date(2026, 10, 1),
                                     status=SaleOrder.Status.CONFIRMED)
    SaleLine.objects.create(order=order, product=product, quantity=Decimal(qty), unit_price=Decimal("1000"),
                            unit_price_gross=Decimal(price), tax_rate=Decimal("19"), uom=env["uom"])
    order.recalculate_totals()
    return order


def _deliver(env, order, qty):
    line = order.lines.get()
    delivery = SaleDelivery.objects.create(sale_order=order, warehouse=env["warehouse"], delivery_date=date(2026, 10, 2))
    dl = SaleDeliveryLine.objects.create(delivery=delivery, sale_line=line, product=line.product, uom=env["uom"],
                                         quantity=Decimal(qty), unit_price=line.unit_price)
    SalesService.confirm_delivery(delivery)
    return dl


def _invoice(items, **kw):
    return InvoiceFromLinesService.create(side="sale", dte_type=FACTURA, items=items, **kw)


@pytest.mark.django_db
def test_partial_invoices_tied_to_deliveries_until_complete(env):
    order = _order(env, env["storable"], 5)
    line = order.lines.get()
    first_delivery = _deliver(env, order, 2)

    inv1 = _invoice([{"order_line_id": line.id, "quantity": 2, "fulfillment_line_id": first_delivery.id}])

    order.refresh_from_db()
    assert order.invoicing_status == SaleOrder.InvoicingStatus.PARTIAL
    assert inv1.total == Decimal("2380")  # 2 × 1190 bruto
    assert inv1.total_net + inv1.total_tax == inv1.total
    entry_total = sum(i.debit for i in inv1.journal_entry.items.all())
    assert entry_total == inv1.total

    second_delivery = _deliver(env, order, 3)
    _invoice([{"order_line_id": line.id, "quantity": 3, "fulfillment_line_id": second_delivery.id}])

    order.refresh_from_db()
    line.refresh_from_db()
    assert order.invoicing_status == SaleOrder.InvoicingStatus.INVOICED
    assert line.quantity_invoiced == Decimal("5")
    assert len(InvoicingService.invoices_of(order)) == 2


@pytest.mark.django_db
def test_cannot_invoice_more_than_delivered(env):
    order = _order(env, env["storable"], 5)
    dl = _deliver(env, order, 2)

    with pytest.raises(ValidationError, match="más de lo entregado"):
        _invoice([{"order_line_id": order.lines.get().id, "quantity": 3, "fulfillment_line_id": dl.id}])


@pytest.mark.django_db
def test_partial_invoice_of_deliverable_requires_delivery_line(env):
    order = _order(env, env["storable"], 5)

    with pytest.raises(ValidationError, match="D1.2"):
        _invoice([{"order_line_id": order.lines.get().id, "quantity": 2}])

    # Servicios: factura parcial sin entrega es válida
    service_order = _order(env, env["service"], 4)
    _invoice([{"order_line_id": service_order.lines.get().id, "quantity": 1}])
    service_order.refresh_from_db()
    assert service_order.invoicing_status == SaleOrder.InvoicingStatus.PARTIAL


@pytest.mark.django_db
def test_multi_order_invoice_same_customer(env):
    a, b = _order(env, env["service"], 2), _order(env, env["service"], 3)

    invoice = _invoice([{"order_line_id": a.lines.get().id, "quantity": 2},
                        {"order_line_id": b.lines.get().id, "quantity": 3}])

    assert {o.pk for o in InvoicingService.orders_of(invoice)} == {a.pk, b.pk}
    assert invoice.total == Decimal("5950")
    for order in (a, b):
        order.refresh_from_db()
        assert order.invoicing_status == SaleOrder.InvoicingStatus.INVOICED
        assert order.status == SaleOrder.Status.INVOICED


@pytest.mark.django_db
def test_multi_order_invoice_rejects_different_customers(env):
    a, b = _order(env, env["service"], 1), _order(env, env["service"], 1, customer=env["other"])

    with pytest.raises(ValidationError, match="mismo cliente"):
        _invoice([{"order_line_id": a.lines.get().id, "quantity": 1},
                  {"order_line_id": b.lines.get().id, "quantity": 1}])


@pytest.mark.django_db
def test_cannot_invoice_more_than_pending(env):
    order = _order(env, env["service"], 2)
    _invoice([{"order_line_id": order.lines.get().id, "quantity": 2}])

    with pytest.raises(ValidationError, match="quedan 0"):
        _invoice([{"order_line_id": order.lines.get().id, "quantity": 1}])


@pytest.mark.django_db
def test_advance_is_split_across_partial_invoices_and_released_on_cancel(env):
    order = _order(env, env["service"], 2)  # total 2380
    advance = TreasuryService.create_movement(
        amount=Decimal("2000"), movement_type=TreasuryMovement.Type.INBOUND, to_account=env["cash"],
        partner=env["customer"], sale_order=order,
    )
    line = order.lines.get()

    inv1 = _invoice([{"order_line_id": line.id, "quantity": 1}])
    inv2 = _invoice([{"order_line_id": line.id, "quantity": 1}])

    assert PaymentAllocation.objects.get(invoice=inv1).amount == Decimal("1190")
    assert PaymentAllocation.objects.get(invoice=inv2).amount == Decimal("810")  # resto del anticipo
    inv1.refresh_from_db()
    inv2.refresh_from_db()
    assert inv1.pending_amount == 0 and inv2.pending_amount == Decimal("380")
    order.refresh_from_db()
    assert order.total_paid == Decimal("2000")  # el anticipo cuenta una sola vez en la orden

    BillingService.cancel_invoice(inv2)
    assert not PaymentAllocation.objects.filter(invoice=inv2).exists()
    order.refresh_from_db()
    assert order.invoicing_status == SaleOrder.InvoicingStatus.PARTIAL
    assert sum(a.amount for a in advance.allocations.all()) == Decimal("1190")


@pytest.mark.django_db
def test_endpoints(env):
    order = _order(env, env["storable"], 4)
    dl = _deliver(env, order, 4)
    client = APIClient()
    client.force_authenticate(get_user_model().objects.create_superuser(username="m4b", password="x", email="m4b@x.cl"))

    listing = client.get("/api/billing/invoices/invoiceable-lines/", {"side": "sale", "partner": env["customer"].id})
    assert listing.status_code == 200
    line = listing.data[0]["lines"][0]
    assert line["pending"] == Decimal("4") and line["fulfillments"][0]["id"] == dl.id

    payload = {"side": "sale", "dte_type": FACTURA,
               "items": [{"order_line_id": line["id"], "quantity": "4", "fulfillment_line_id": dl.id}]}
    res = client.post("/api/billing/invoices/from-lines/", payload, format="json",
                      HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()))
    assert res.status_code == 201, res.data
    assert len(res.data["lines"]) == 1

    bad = client.post("/api/billing/invoices/from-lines/", payload, format="json",
                      HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()))
    assert bad.status_code == 400 and "quedan 0" in bad.data["error"]
