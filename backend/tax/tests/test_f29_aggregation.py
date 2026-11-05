"""F29: los totales por tipo DTE se mantienen exactos al agregarse en SQL."""

from datetime import date
from decimal import Decimal

import pytest

from billing.models import Invoice
from contacts.models import Contact
from sales.models import SaleOrder
from tax.services import F29CalculationService

PERIOD = (2026, 8)


def _invoice(dte_type, total_net, sale_order=None, contact=None):
    return Invoice.objects.create(
        dte_type=dte_type,
        contact=contact,
        sale_order=sale_order,
        status=Invoice.Status.POSTED,
        date=date(2026, 8, 15),
        total=Decimal(total_net) * Decimal("1.19"),
        total_net=Decimal(total_net),
        total_tax=Decimal(total_net) * Decimal("0.19"),
    )


@pytest.fixture
def month(db):
    contact = Contact.objects.create(name="Contacto F29", tax_id="F29-1")
    order = SaleOrder.objects.create(customer=contact, date=date(2026, 8, 1), total=Decimal("1000"), status=SaleOrder.Status.CONFIRMED)
    # Sales (with sale_order)
    _invoice(Invoice.DTEType.FACTURA, 1000, sale_order=order, contact=contact)
    _invoice(Invoice.DTEType.FACTURA, 500, sale_order=order, contact=contact)
    _invoice(Invoice.DTEType.FACTURA_EXENTA, 300, sale_order=order, contact=contact)
    _invoice(Invoice.DTEType.NOTA_CREDITO, 100, sale_order=order, contact=contact)
    _invoice(Invoice.DTEType.NOTA_DEBITO, 50, sale_order=order, contact=contact)
    _invoice(Invoice.DTEType.NOTA_CREDITO, 40, sale_order=order, contact=contact)
    # Purchases (no sale_order)
    _invoice(Invoice.DTEType.FACTURA, 2000, contact=contact)
    _invoice(Invoice.DTEType.BOLETA, 700, contact=contact)  # boletas give no VAT credit
    _invoice(Invoice.DTEType.FACTURA_EXENTA, 400, contact=contact)
    _invoice(Invoice.DTEType.NOTA_CREDITO, 200, contact=contact)
    _invoice(Invoice.DTEType.NOTA_DEBITO, 30, contact=contact)


@pytest.mark.django_db
def test_totals_by_document_type(month):
    result = F29CalculationService.calculate_f29_for_period(*PERIOD)

    assert result["sales_taxed"] == Decimal("1500")  # 1000 + 500
    assert result["sales_exempt"] == Decimal("300")
    assert result["credit_notes_taxed"] == Decimal("140")  # 100 + 40
    assert result["debit_notes_taxed"] == Decimal("50")
    assert result["purchases_taxed"] == Decimal("2000")
    assert result["purchases_exempt"] == Decimal("400")
    assert result["purchase_credit_notes"] == Decimal("200")
    assert result["purchase_debit_notes"] == Decimal("30")


@pytest.mark.django_db
def test_breakdown_by_dte_counts_and_totals(month):
    result = F29CalculationService.calculate_f29_for_period(*PERIOD)

    by_type = {row["dte_type"]: row for row in result["sales_taxed_by_dte"]}
    assert by_type[Invoice.DTEType.FACTURA]["count"] == 2
    assert by_type[Invoice.DTEType.FACTURA]["total"] == Decimal("1500")
    purchases = {row["dte_type"]: row for row in result["purchases_taxed_by_dte"]}
    assert purchases[Invoice.DTEType.FACTURA]["total"] == Decimal("2000")
    assert Invoice.DTEType.BOLETA not in {row["dte_type"] for row in result["purchases_taxed_by_dte"]}
