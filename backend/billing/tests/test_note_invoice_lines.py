"""
M4c / GAP-14 (ADR-0081, decisión D1.3): las NC/ND tienen líneas propias que apuntan a la
línea de la factura que corrigen; lo acreditado no puede superar lo facturado.
"""

from datetime import date
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError

from accounting.models import Account, AccountingSettings, AccountType
from billing.invoice_from_lines import InvoiceFromLinesService
from billing.models import Invoice
from billing.note_checkout_service import NoteCheckoutService
from billing.selectors import InvoiceSelectorExt
from contacts.models import Contact
from inventory.models import Product, ProductCategory, UoM, UoMCategory
from sales.models import SaleLine, SaleOrder

NC, ND = Invoice.DTEType.NOTA_CREDITO, Invoice.DTEType.NOTA_DEBITO


@pytest.fixture
def env(db):
    def acc(code, name, kind):
        return Account.objects.create(code=code, name=name, account_type=kind)

    settings = AccountingSettings.get_solo()
    settings.default_receivable_account = acc("1.1.03.083", "Clientes", AccountType.ASSET)
    settings.default_revenue_account = acc("4.1.01.083", "Ventas", AccountType.INCOME)
    settings.default_tax_payable_account = acc("2.1.05.083", "IVA Débito", AccountType.LIABILITY)
    settings.save()
    uom_cat, _ = UoMCategory.objects.get_or_create(name="Unidades")
    uom, _ = UoM.objects.get_or_create(name="unidad", defaults={"ratio": 1, "category": uom_cat})
    cat, _ = ProductCategory.objects.get_or_create(name="Test", defaults={"prefix": "TST"})
    service = Product.objects.create(name="Diseño", internal_code="DIS-83", product_type=Product.Type.SERVICE,
                                     uom=uom, category=cat, cost_price=Decimal("0"))
    customer = Contact.objects.create(name="Imprenta Norte", tax_id="12345678-9")
    order = SaleOrder.objects.create(customer=customer, date=date(2026, 10, 1), status=SaleOrder.Status.CONFIRMED)
    line = SaleLine.objects.create(order=order, product=service, quantity=Decimal("4"), unit_price=Decimal("1000"),
                                   unit_price_gross=Decimal("1190"), tax_rate=Decimal("19"), uom=uom)
    order.recalculate_totals()
    invoice = InvoiceFromLinesService.create(
        side="sale", dte_type=Invoice.DTEType.FACTURA, items=[{"order_line_id": line.id, "quantity": 4}],
        status=Invoice.Status.POSTED, number="F-83",
    )
    return {"service": service, "line": line, "invoice": invoice}


def _note(env, note_type, quantity, line_id=None):
    workflow = NoteCheckoutService._process_full_checkout_internal(
        original_invoice_id=env["invoice"].id,
        note_type=note_type,
        selected_items=[{
            "product_id": env["service"].id, "quantity": quantity, "unit_price": 1000, "tax_amount": 190,
            "line_id": line_id if line_id is not None else env["line"].id,
        }],
        registration_data={"document_number": f"{note_type}-{quantity}", "is_pending": True},
        reason="test",
    )
    return workflow.invoice


@pytest.mark.django_db
def test_credit_note_lines_reference_invoice_lines(env):
    note = _note(env, NC, 3)

    note_line = note.lines.get()
    assert note_line.corrected_line == env["invoice"].lines.get()
    assert note_line.quantity == Decimal("3") and note_line.subtotal == Decimal("3000")

    data = InvoiceSelectorExt.get_lines(note)
    assert data[0]["quantity"] == Decimal("3")
    assert data[0]["quantity_delivered"] == 0, "procesado de la NC = devuelto para esta nota"


@pytest.mark.django_db
def test_cannot_credit_more_than_invoiced(env):
    _note(env, NC, 3)

    with pytest.raises(ValidationError, match="quedan 1"):
        _note(env, NC, 2)


@pytest.mark.django_db
def test_debit_note_lines_use_their_supplemental_line(env):
    note = _note(env, ND, 1)

    note_line = note.lines.get()
    assert note_line.sale_line.related_note_id == note.id, "la ND factura su línea adicional"
    assert note_line.corrected_line is None
