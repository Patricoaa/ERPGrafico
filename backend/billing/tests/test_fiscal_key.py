"""ADR-0138 D2: clave fiscal de Invoice y dirección fiscal única."""

from datetime import date

import pytest

from billing.fiscal_key import (
    FISCAL_KEY_RELATED,
    FiscalKey,
    fiscal_direction_expression,
    fiscal_key,
    invoice_direction,
    parse_folio,
)
from billing.models import Invoice
from contacts.models import Contact
from purchasing.models import PurchaseOrder
from sales.models import SaleOrder

pytestmark = pytest.mark.django_db


def _invoice(dte_type=Invoice.DTEType.FACTURA, **kwargs):
    return Invoice.objects.create(
        dte_type=dte_type, status=Invoice.Status.POSTED, date=date(2026, 8, 15), **kwargs
    )


@pytest.fixture
def parties(db):
    supplier = Contact.objects.create(name="Proveedor", tax_id="8.973.356-k")
    po = PurchaseOrder.objects.create(supplier=supplier, status="DRAFT")
    so = SaleOrder.objects.create(customer=supplier, date=date(2026, 8, 1), status=SaleOrder.Status.CONFIRMED)
    return {"supplier": supplier, "po": po, "so": so}


def test_parse_folio_strips_zeros_and_dots():
    assert parse_folio("000123") == 123
    assert parse_folio("1.234") == 1234
    assert parse_folio("") is None
    assert parse_folio(None) is None
    assert parse_folio("ABC") is None
    assert parse_folio("0") is None


def test_purchase_inv_and_factura_with_po_share_key(parties):
    a = _invoice(Invoice.DTEType.PURCHASE_INV, number="55", partner_tax_id_snapshot="8973356-K")
    b = _invoice(purchase_order=parties["po"], number="55", partner_tax_id_snapshot="8973356-K")
    expected = FiscalKey("purchase", 33, 55, "8973356-K")
    assert fiscal_key(a) == expected
    assert fiscal_key(b) == expected


def test_rut_is_normalized(parties):
    inv = _invoice(number="7", partner_tax_id_snapshot="8.973.356-k")
    assert fiscal_key(inv).counterparty_rut == "8973356-K"


def test_rut_falls_back_to_contact(parties):
    inv = _invoice(number="7", contact=parties["supplier"])
    assert fiscal_key(inv).counterparty_rut == "8973356-K"


def test_note_inherits_direction_from_corrected_invoice(parties):
    original = _invoice(purchase_order=parties["po"], number="10")
    note = _invoice(Invoice.DTEType.NOTA_CREDITO, corrected_invoice=original, number="11")
    assert invoice_direction(note) == "purchase"


def test_standalone_invoice_is_sale():
    assert invoice_direction(_invoice(number="1")) == "sale"


def test_expression_matches_python_rule(parties):
    original = _invoice(purchase_order=parties["po"], number="10")
    cases = [
        _invoice(Invoice.DTEType.PURCHASE_INV, number="1"),
        original,
        _invoice(sale_order=parties["so"], number="2"),
        _invoice(Invoice.DTEType.NOTA_CREDITO, corrected_invoice=original, number="3"),
        _invoice(number="4"),
    ]
    rows = Invoice.objects.select_related(*FISCAL_KEY_RELATED).annotate(direction=fiscal_direction_expression())
    assert rows.count() == len(cases)
    assert {inv.direction for inv in rows} == {"purchase", "sale"}
    for inv in rows:
        assert inv.direction == invoice_direction(inv), inv.pk


def test_fiscal_key_with_related_does_not_query_per_row(parties, django_assert_num_queries):
    original = _invoice(purchase_order=parties["po"], number="10", contact=parties["supplier"])
    _invoice(Invoice.DTEType.NOTA_CREDITO, corrected_invoice=original, number="11", contact=parties["supplier"])
    with django_assert_num_queries(1):
        [fiscal_key(i) for i in Invoice.objects.select_related(*FISCAL_KEY_RELATED)]
