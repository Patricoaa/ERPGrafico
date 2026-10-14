"""
GAP-05 (auditoría documental): `Invoice.source_order` (GFK) nunca se escribe,
así que la lógica que dependía de él no se ejecutaba. Ahora usa `Invoice.order`
(FK tipadas `sale_order` / `purchase_order`).
"""

from datetime import date
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError

from billing.models import Invoice
from billing.services import BillingService
from contacts.models import Contact
from inventory.models import Warehouse
from purchasing.models import PurchaseOrder
from sales.models import SaleOrder


@pytest.fixture
def env(db):
    customer = Contact.objects.create(name="Cliente", tax_id="11111111-1")
    supplier_a = Contact.objects.create(name="Proveedor A", tax_id="22222222-2")
    supplier_b = Contact.objects.create(name="Proveedor B", tax_id="33333333-3")
    warehouse = Warehouse.objects.create(name="Bodega", code="WH-G5")
    return {"customer": customer, "suppliers": (supplier_a, supplier_b), "warehouse": warehouse}


def _po(env, supplier, number, **kw):
    return PurchaseOrder.objects.create(
        number=number, supplier=supplier, warehouse=env["warehouse"],
        total=0, total_net=0, total_tax=0, **kw,
    )


def _invoice(**kw):
    return Invoice.objects.create(total=Decimal("1000"), total_net=Decimal("840"), total_tax=Decimal("160"), **kw)


@pytest.mark.django_db
def test_order_property_and_sale_side(env):
    so = SaleOrder.objects.create(customer=env["customer"], date=date(2026, 10, 1))
    po = _po(env, env["suppliers"][0], "PO-G5-1")
    sale_inv = _invoice(dte_type=Invoice.DTEType.FACTURA, contact=env["customer"], sale_order=so)
    purchase_inv = _invoice(dte_type=Invoice.DTEType.PURCHASE_INV, contact=env["suppliers"][0], purchase_order=po)
    standalone = _invoice(dte_type=Invoice.DTEType.BOLETA, contact=env["customer"])

    assert sale_inv.order == so and sale_inv.is_sale_document()
    assert purchase_inv.order == po and not purchase_inv.is_sale_document()
    assert standalone.order is None and standalone.is_sale_document()
    assert sale_inv.get_customer_for_payment() == env["customer"]


@pytest.mark.django_db
def test_purchase_folio_is_unique_per_supplier(env):
    supplier_a, supplier_b = env["suppliers"]
    _invoice(
        dte_type=Invoice.DTEType.PURCHASE_INV, contact=supplier_a, number="777",
        status=Invoice.Status.POSTED, purchase_order=_po(env, supplier_a, "PO-G5-2"),
    )
    same_supplier = _invoice(
        dte_type=Invoice.DTEType.PURCHASE_INV, contact=supplier_a,
        purchase_order=_po(env, supplier_a, "PO-G5-3"),
    )
    other_supplier = _invoice(
        dte_type=Invoice.DTEType.PURCHASE_INV, contact=supplier_b,
        purchase_order=_po(env, supplier_b, "PO-G5-4"),
    )

    with pytest.raises(ValidationError, match="proveedor"):
        BillingService.confirm_invoice(same_supplier, "777")
    BillingService.confirm_invoice(other_supplier, "777")
    other_supplier.refresh_from_db()
    assert other_supplier.number == "777"


@pytest.mark.django_db
def test_annul_invoice_reverts_order_status(env):
    so = SaleOrder.objects.create(
        customer=env["customer"], date=date(2026, 10, 1), status=SaleOrder.Status.INVOICED
    )
    inv = _invoice(dte_type=Invoice.DTEType.FACTURA, contact=env["customer"], sale_order=so,
                   status=Invoice.Status.POSTED)

    BillingService.annul_invoice(inv, reason="test")

    so.refresh_from_db()
    assert so.status == SaleOrder.Status.CONFIRMED


@pytest.mark.django_db
def test_annul_invoice_keeps_order_status_when_other_invoice_active(env):
    so = SaleOrder.objects.create(
        customer=env["customer"], date=date(2026, 10, 1), status=SaleOrder.Status.INVOICED
    )
    inv = _invoice(dte_type=Invoice.DTEType.FACTURA, contact=env["customer"], sale_order=so,
                   status=Invoice.Status.POSTED)
    _invoice(dte_type=Invoice.DTEType.FACTURA, contact=env["customer"], sale_order=so,
             status=Invoice.Status.POSTED)

    BillingService.annul_invoice(inv, reason="test")

    so.refresh_from_db()
    assert so.status == SaleOrder.Status.INVOICED
