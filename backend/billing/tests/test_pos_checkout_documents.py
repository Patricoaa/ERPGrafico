"""Checkout POS multi-documento: 39/48 según el medio de pago (ADR-0138 D3)."""

from datetime import date
from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from billing.models import Invoice
from billing.services import BillingService
from sales.models import SaleLine, SaleOrder
from treasury.models import (
    PaymentMethod,
    PaymentTerminalDevice,
    POSTerminal,
    TreasuryMovement,
)
from treasury.tests.helpers import make_pos_session, make_terminal_provider

D = Decimal


@pytest.fixture
def pos(env, django_user_model):
    user = django_user_model.objects.create_user(username="cajero", password="x")
    terminal = POSTerminal.objects.create(name="Caja 1", code="C-1", default_treasury_account=env["cash"])
    cash = PaymentMethod.objects.create(name="Efectivo", method_type="CASH", treasury_account=env["cash"])
    provider = make_terminal_provider()
    device = PaymentTerminalDevice.objects.create(name="D1", serial_number="SN-1", provider=provider)
    card = PaymentMethod.objects.create(
        name="Tarjeta", method_type=PaymentMethod.Type.CARD_TERMINAL,
        treasury_account=env["cash"], linked_terminal_device=device,
    )
    terminal.allowed_payment_methods.add(cash, card)
    session = make_pos_session(user, terminal=terminal)
    return {"user": user, "session": session, "cash": cash, "card": card}


def _order(env):
    """OV en borrador por 10000 brutos (el checkout la confirma)."""
    order = SaleOrder.objects.create(customer=env["customer"], date=date(2026, 10, 1))
    SaleLine.objects.create(order=order, product=env["service"], quantity=D("4"),
                            unit_price=D("2100.84"), unit_price_gross=D("2500"),
                            tax_rate=D("19"), uom=env["uom"])
    order.recalculate_totals()
    order.refresh_from_db()
    assert order.total == D("10000")
    return order


def _checkout(order, pos, dte_type="BOLETA", payment_method="CASH", **kw):
    return BillingService._pos_checkout_internal(
        order_data={"id": order.id}, dte_type=dte_type, payment_method=payment_method,
        delivery_type="PICKUP", pos_session_id=pos["session"].id, user=pos["user"], **kw,
    )


def _alloc(method, amount):
    kind = "CARD_TERMINAL" if method.method_type == PaymentMethod.Type.CARD_TERMINAL else "CASH"
    return {"method": kind, "amount": str(amount), "payment_method_id": method.id}


@pytest.mark.django_db
def test_boleta_paid_with_integrated_terminal_is_48(env, pos):
    order = _order(env)

    inv = _checkout(order, pos, payment_method="CARD", payment_method_id=pos["card"].id)

    assert list(order.invoices.all()) == [inv]
    assert inv.dte_type == Invoice.DTEType.COMPROBANTE_PAGO
    assert inv.status == Invoice.Status.POSTED
    assert inv.number == ""
    assert TreasuryMovement.objects.filter(sale_order=order, invoice=inv).exists()
    assert inv.checkout_documents == [inv]


@pytest.mark.django_db
def test_boleta_cash_is_39_without_invented_folio(env, pos):
    order = _order(env)

    inv = _checkout(order, pos, payment_method_id=pos["cash"].id)

    assert inv.dte_type == Invoice.DTEType.BOLETA
    assert inv.status == Invoice.Status.POSTED
    assert inv.number == ""
    assert TreasuryMovement.objects.filter(sale_order=order, invoice=inv).exists()


@pytest.mark.django_db
def test_mixed_payment_creates_two_documents(env, pos):
    order = _order(env)

    inv = _checkout(order, pos, payments=[_alloc(pos["card"], 6000), _alloc(pos["cash"], 4000)])

    docs = {d.dte_type: d for d in order.invoices.all()}
    assert set(docs) == {Invoice.DTEType.COMPROBANTE_PAGO, Invoice.DTEType.BOLETA}
    c48, b39 = docs[Invoice.DTEType.COMPROBANTE_PAGO], docs[Invoice.DTEType.BOLETA]
    assert (c48.total, b39.total) == (D("6000"), D("4000"))
    assert c48.total_net + c48.total_tax == D("6000")
    assert b39.total_net + b39.total_tax == D("4000")
    assert TreasuryMovement.objects.get(sale_order=order, amount=D("6000")).invoice_id == c48.id
    assert TreasuryMovement.objects.get(sale_order=order, amount=D("4000")).invoice_id == b39.id
    order.refresh_from_db()
    assert order.invoicing_status == SaleOrder.InvoicingStatus.INVOICED
    assert inv == c48
    assert len(inv.checkout_documents) == 2
    summary = BillingService.checkout_documents_summary(inv)
    assert [(d["id"], d["dte_type"], d["total"]) for d in summary] == [
        (c48.id, "COMPROBANTE_PAGO", "6000"), (b39.id, "BOLETA", "4000"),
    ]


@pytest.mark.django_db
def test_factura_with_terminal_single_document(env, pos):
    order = _order(env)

    inv = _checkout(order, pos, dte_type="FACTURA", payment_method="CARD",
                    payment_method_id=pos["card"].id, document_number="991")

    assert list(order.invoices.all()) == [inv]
    assert inv.dte_type == Invoice.DTEType.FACTURA
    assert inv.number == "991"


@pytest.mark.django_db
def test_user_folio_goes_to_boleta_not_48(env, pos):
    order = _order(env)

    _checkout(order, pos, document_number="777",
              payments=[_alloc(pos["card"], 6000), _alloc(pos["cash"], 4000)])

    docs = {d.dte_type: d for d in order.invoices.all()}
    assert docs[Invoice.DTEType.BOLETA].number == "777"
    assert docs[Invoice.DTEType.COMPROBANTE_PAGO].number == ""


@pytest.mark.django_db
def test_extra_payment_outside_plans_goes_to_principal(env, pos):
    order = _order(env)

    inv = _checkout(order, pos, payments=[_alloc(pos["card"], 10000), _alloc(pos["cash"], 500)])

    assert list(order.invoices.all()) == [inv]
    assert inv.dte_type == Invoice.DTEType.COMPROBANTE_PAGO
    assert set(TreasuryMovement.objects.filter(sale_order=order).values_list("invoice_id", flat=True)) == {inv.id}


def _payment_method_queries(env, pos, n):
    order = _order(env)
    allocs = [_alloc(pos["cash"], D(10000) / n) for _ in range(n)]
    with CaptureQueriesContext(connection) as ctx:
        _checkout(order, pos, payments=allocs)
    return sum(1 for q in ctx.captured_queries if "treasury_paymentmethod" in q["sql"])


@pytest.mark.django_db
def test_checkout_queries_do_not_grow_with_payments(env, pos):
    two = _payment_method_queries(env, pos, 2)
    four = _payment_method_queries(env, pos, 4)

    assert two == four
    assert two <= 2


@pytest.mark.django_db
def test_single_partial_card_rest_on_credit_links_card_to_48(env, pos):
    order = _order(env)
    env["customer"].credit_limit = D("100000")
    env["customer"].save()

    inv = _checkout(order, pos, payment_method="CARD", payment_method_id=pos["card"].id, amount="3000")

    docs = {d.dte_type: d for d in inv.checkout_documents}
    assert docs[Invoice.DTEType.BOLETA].total == D("7000")
    assert docs[Invoice.DTEType.COMPROBANTE_PAGO].total == D("3000")
    movement = TreasuryMovement.objects.get(sale_order=order)
    assert movement.invoice_id == docs[Invoice.DTEType.COMPROBANTE_PAGO].id
