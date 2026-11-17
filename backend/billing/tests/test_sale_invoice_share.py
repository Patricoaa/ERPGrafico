"""ADR-0138 D3 — facturas por porción de la OV y boletas POS sin folio inventado."""

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

from accounting.models import JournalEntry
from billing.invoicing import InvoicingService
from billing.line_split import LineAmount, split_lines, split_proportional
from billing.models import Invoice
from billing.services import BillingService
from sales.models import SaleLine, SaleOrder
from treasury.models import TreasuryMovement

BOLETA = Invoice.DTEType.BOLETA
FACTURA = Invoice.DTEType.FACTURA


def _order(env):
    """OV confirmada con dos líneas: 10000 y 3333 brutos."""
    order = SaleOrder.objects.create(customer=env["customer"], date=date(2026, 10, 1),
                                     status=SaleOrder.Status.CONFIRMED)
    SaleLine.objects.create(order=order, product=env["service"], quantity=Decimal("10"),
                            unit_price=Decimal("840.34"), unit_price_gross=Decimal("1000"),
                            tax_rate=Decimal("19"), uom=env["uom"])
    SaleLine.objects.create(order=order, product=env["service"], quantity=Decimal("1"),
                            unit_price=Decimal("2800.84"), unit_price_gross=Decimal("3333"),
                            tax_rate=Decimal("19"), uom=env["uom"])
    order.recalculate_totals()
    order.refresh_from_db()
    return order


def _portions(order, amounts):
    """(line_shares, net_tax_discount) por documento, como lo hará el checkout POS."""
    sale_lines = list(order.lines.filter(related_note__isnull=True).order_by("id"))
    lines = [LineAmount(key=sl.pk, quantity=sl.quantity, subtotal=sl.subtotal) for sl in sale_lines]
    line_amounts = split_proportional(sum((sl.subtotal for sl in sale_lines), Decimal(0)), amounts)
    shares = split_lines(lines, line_amounts)
    nets = split_proportional(order.total_net, amounts)
    # El IVA es el complemento del neto: split_proportional por separado puede dejar
    # neto + IVA un peso bajo el monto del documento (asiento descuadrado).
    taxes = [amount - net for amount, net in zip(amounts, nets, strict=True)]
    discounts = split_proportional(order.total_discount_amount, amounts)
    return [(shares[i], (nets[i], taxes[i], discounts[i])) for i in range(len(amounts))]


def _share_invoice(order, amount, shares, ntd, dte_type=BOLETA, **kw):
    return BillingService.create_sale_invoice(
        order, dte_type, payment_method="CARD", number=kw.pop("number", "B-1"),
        amount=amount, line_shares=shares, net_tax_discount=ntd, **kw,
    )


@pytest.mark.django_db
def test_full_invoice_unchanged(env):
    order = _order(env)
    assert order.total == Decimal("13333")

    inv = BillingService.create_sale_invoice(order, FACTURA, number="1001")

    assert inv.total == order.total
    assert inv.lines.count() == order.lines.count() == 2


@pytest.mark.django_db
def test_share_invoice_totals_and_lines(env):
    order = _order(env)
    amounts = [Decimal("6000"), order.total - Decimal("6000")]
    shares, ntd = _portions(order, amounts)[0]

    inv = _share_invoice(order, Decimal("6000"), shares, ntd)

    assert inv.total == Decimal("6000")
    assert inv.total_net + inv.total_tax == Decimal("6000")
    assert sum(line.subtotal for line in inv.lines.all()) == Decimal("6000")
    items = list(inv.journal_entry.items.all())
    assert sum(i.debit for i in items) == sum(i.credit for i in items)
    receivable = inv.journal_entry.items.get(account__code="1.1.03.082")
    assert receivable.debit == Decimal("6000")


@pytest.mark.django_db
def test_two_shares_invoice_order_exactly(env):
    order = _order(env)
    amounts = [Decimal("6000"), order.total - Decimal("6000")]  # Σ = total de la OV
    portions = _portions(order, amounts)

    for i, (shares, ntd) in enumerate(portions):
        _share_invoice(order, amounts[i], shares, ntd, number=f"B-{i + 1}")

    InvoicingService.recompute_order(order)
    for line in order.lines.all():
        assert line.quantity_invoiced == line.quantity
    order.refresh_from_db()
    assert order.invoicing_status == SaleOrder.InvoicingStatus.INVOICED


@pytest.mark.django_db
def test_share_invoice_rejects_net_plus_tax_not_matching_amount(env):
    order = _order(env)
    shares, (net, tax, discount) = _portions(order, [Decimal("6000"), order.total - Decimal("6000")])[0]

    with pytest.raises(ValidationError, match="neto"):
        _share_invoice(order, Decimal("6000"), shares, (net, tax - 1, discount))


@pytest.mark.django_db
def test_boleta_without_folio_is_draft(env):
    order = _order(env)

    inv = BillingService.create_sale_invoice(order, BOLETA, number=None)

    assert inv.status == Invoice.Status.DRAFT
    assert inv.number == ""


@pytest.mark.django_db
def test_factura_without_folio_is_draft(env):
    order = _order(env)

    inv = BillingService.create_sale_invoice(order, FACTURA, number=None)

    assert inv.status == Invoice.Status.DRAFT


def _advance(env, order, amount):
    user = get_user_model().objects.create_user(username="anticipo", password="x")
    return TreasuryMovement.objects.create(
        movement_type=TreasuryMovement.Type.INBOUND, amount=Decimal(amount), created_by=user,
        contact=env["customer"], to_account=env["cash"], sale_order=order,
    )


@pytest.mark.django_db
def test_link_advances_false_skips_advance_reconciliation(env):
    order = _order(env)
    advance = _advance(env, order, "6000")
    shares, ntd = _portions(order, [Decimal("6000"), order.total - Decimal("6000")])[0]

    inv = _share_invoice(order, Decimal("6000"), shares, ntd, link_advances=False)

    advance.refresh_from_db()
    assert advance.invoice_id is None
    assert not JournalEntry.objects.filter(reference=f"RECO-{inv.id}").exists()


@pytest.mark.django_db
def test_link_advances_default_links_advance(env):
    order = _order(env)
    advance = _advance(env, order, "6000")

    inv = BillingService.create_sale_invoice(order, FACTURA, number="1002")

    advance.refresh_from_db()
    assert advance.invoice_id == inv.id


@pytest.mark.django_db
def test_share_invoice_rejects_advances_above_amount(env):
    order = _order(env)
    _advance(env, order, "7000")
    shares, ntd = _portions(order, [Decimal("6000"), order.total - Decimal("6000")])[0]

    with pytest.raises(ValidationError, match="anticipos"):
        _share_invoice(order, Decimal("6000"), shares, ntd)
