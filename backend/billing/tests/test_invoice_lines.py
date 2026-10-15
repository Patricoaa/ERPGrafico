"""
M4a (ADR-0081): la factura tiene líneas propias, la orden lleva quantity_invoiced e
invoicing_status, y factura ↔ orden se deriva de las líneas (N:M, decisión D1).
"""

from datetime import date
from decimal import Decimal
from io import StringIO

import pytest
from django.core.management import call_command

from accounting.models import Account, AccountingSettings, AccountType
from billing.invoicing import InvoicingService
from billing.models import Invoice, InvoiceLine
from billing.selectors import InvoiceSelectorExt
from billing.services import BillingService
from contacts.models import Contact
from inventory.models import Product, ProductCategory, UoM, UoMCategory, Warehouse
from purchasing.models import PurchaseLine, PurchaseOrder
from sales.models import SaleLine, SaleOrder


@pytest.fixture
def env(db):
    def acc(code, name, kind):
        return Account.objects.create(code=code, name=name, account_type=kind)

    settings = AccountingSettings.get_solo()
    settings.default_receivable_account = acc("1.1.03.081", "Clientes", AccountType.ASSET)
    settings.default_revenue_account = acc("4.1.01.081", "Ventas", AccountType.INCOME)
    settings.default_tax_payable_account = acc("2.1.05.081", "IVA Débito", AccountType.LIABILITY)
    settings.default_payable_account = acc("2.1.01.081", "Proveedores", AccountType.LIABILITY)
    settings.default_tax_receivable_account = acc("1.1.06.081", "IVA Crédito", AccountType.ASSET)
    settings.stock_input_account = acc("2.1.09.081", "Mercadería por recibir", AccountType.LIABILITY)
    settings.save()

    uom_cat, _ = UoMCategory.objects.get_or_create(name="Unidades")
    uom, _ = UoM.objects.get_or_create(name="unidad", defaults={"ratio": 1, "category": uom_cat})
    cat, _ = ProductCategory.objects.get_or_create(name="Test", defaults={"prefix": "TST"})
    products = [
        Product.objects.create(name=f"Servicio {i}", internal_code=f"SRV-81{i}", product_type=Product.Type.SERVICE,
                               uom=uom, category=cat, cost_price=Decimal("0"))
        for i in range(2)
    ]
    customer = Contact.objects.create(name="Imprenta Norte", tax_id="12345678-9")
    supplier = Contact.objects.create(name="Papelera Sur", tax_id="22222222-2")
    return {"uom": uom, "products": products, "customer": customer, "supplier": supplier}


def _sale_order(env, quantities=(2, 3)):
    order = SaleOrder.objects.create(customer=env["customer"], date=date(2026, 10, 1), status=SaleOrder.Status.CONFIRMED)
    for product, qty in zip(env["products"], quantities):
        SaleLine.objects.create(order=order, product=product, quantity=Decimal(qty),
                                unit_price=Decimal("1000"), tax_rate=Decimal("19"), uom=env["uom"])
    order.recalculate_totals() if hasattr(order, "recalculate_totals") else None
    order.refresh_from_db()
    return order


@pytest.mark.django_db
def test_sale_invoice_gets_own_lines_and_order_counters(env):
    order = _sale_order(env)

    invoice = BillingService.create_sale_invoice(order, Invoice.DTEType.FACTURA, status=Invoice.Status.DRAFT)

    lines = list(invoice.lines.order_by("id"))
    assert [(il.sale_line.product_id, il.quantity) for il in lines] == [
        (env["products"][0].id, Decimal("2")), (env["products"][1].id, Decimal("3")),
    ]
    order.refresh_from_db()
    assert order.invoicing_status == SaleOrder.InvoicingStatus.INVOICED
    assert [sl.quantity_invoiced for sl in order.lines.order_by("id")] == [Decimal("2"), Decimal("3")]

    # Contrato de lectura compatible: id = línea de OV, + invoice_line_id
    data = InvoiceSelectorExt.get_lines(invoice)
    assert [item["id"] for item in data] == [il.sale_line_id for il in lines]
    assert [item["invoice_line_id"] for item in data] == [il.id for il in lines]


@pytest.mark.django_db
def test_cancelling_invoice_resets_order_counters(env):
    order = _sale_order(env)
    invoice = BillingService.create_sale_invoice(order, Invoice.DTEType.FACTURA, status=Invoice.Status.DRAFT)

    BillingService.cancel_invoice(invoice)

    order.refresh_from_db()
    assert order.invoicing_status == SaleOrder.InvoicingStatus.PENDING
    assert all(sl.quantity_invoiced == 0 for sl in order.lines.all())


@pytest.mark.django_db
def test_partial_status_when_some_quantity_is_invoiced(env):
    order = _sale_order(env)
    invoice = Invoice.objects.create(dte_type=Invoice.DTEType.FACTURA, sale_order=order, contact=env["customer"])
    first = order.lines.order_by("id").first()
    InvoiceLine.objects.create(invoice=invoice, sale_line=first, product=first.product, quantity=Decimal("1"))

    InvoicingService.recompute_order(order)

    order.refresh_from_db()
    assert order.invoicing_status == SaleOrder.InvoicingStatus.PARTIAL


@pytest.mark.django_db
def test_purchase_bill_gets_own_lines(env):
    warehouse = Warehouse.objects.create(name="Bodega", code="WH-81")
    po = PurchaseOrder.objects.create(number="PO-81", supplier=env["supplier"], warehouse=warehouse,
                                      total=0, total_net=0, total_tax=0, status=PurchaseOrder.Status.CONFIRMED)
    PurchaseLine.objects.create(order=po, product=env["products"][0], quantity=Decimal("4"),
                                unit_cost=Decimal("500"), uom=env["uom"])

    invoice = BillingService.create_purchase_bill(po, dte_type=Invoice.DTEType.PURCHASE_INV, status=Invoice.Status.DRAFT)

    assert invoice.lines.get().purchase_line.order == po
    po.refresh_from_db()
    assert po.invoicing_status == PurchaseOrder.InvoicingStatus.INVOICED


@pytest.mark.django_db
def test_legacy_note_lines_are_the_notes_own_lines(env):
    order = _sale_order(env)
    note = Invoice.objects.create(dte_type=Invoice.DTEType.NOTA_DEBITO, sale_order=order, contact=env["customer"])
    note_line = SaleLine.objects.create(order=order, product=env["products"][0], quantity=Decimal("1"),
                                        unit_price=Decimal("50"), uom=env["uom"], related_note=note)

    assert [item["id"] for item in InvoiceSelectorExt.get_lines(note)] == [note_line.id]


@pytest.mark.django_db
def test_multi_order_invoice_relations_come_from_lines(env):
    order_a, order_b = _sale_order(env), _sale_order(env)
    invoice = BillingService.create_sale_invoice(order_a, Invoice.DTEType.FACTURA, status=Invoice.Status.DRAFT)
    line_b = order_b.lines.first()
    InvoiceLine.objects.create(invoice=invoice, sale_line=line_b, product=line_b.product, quantity=line_b.quantity)

    assert {o.pk for o in InvoicingService.orders_of(invoice)} == {order_a.pk, order_b.pk}
    assert list(InvoicingService.invoices_of(order_b)) == [invoice]


@pytest.mark.django_db
def test_backfill_command_dry_run_and_apply(env):
    order = _sale_order(env)
    legacy = Invoice.objects.create(dte_type=Invoice.DTEType.FACTURA, sale_order=order, contact=env["customer"],
                                    status=Invoice.Status.POSTED)

    out = StringIO()
    call_command("backfill_invoice_lines", stdout=out)
    assert "facturas con líneas espejo: 1" in out.getvalue()
    assert not legacy.lines.exists()

    call_command("backfill_invoice_lines", "--apply", stdout=StringIO())
    assert legacy.lines.count() == 2
    order.refresh_from_db()
    assert order.invoicing_status == SaleOrder.InvoicingStatus.INVOICED
