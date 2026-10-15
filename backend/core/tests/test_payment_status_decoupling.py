"""ADR-0084: el pago no escribe el estado del documento; `payment_status` se deriva del saldo."""

from decimal import Decimal

import pytest

from billing.models import Invoice
from core.payment_status import PaymentStatus, filter_by_payment_status, payment_status_for
from core.tests.test_document_relations import pilot  # noqa: F401  (fixture)
from sales.models import SaleOrder


def test_payment_status_for():
    assert payment_status_for(Decimal("100"), Decimal("0")) == PaymentStatus.UNPAID
    assert payment_status_for(Decimal("100"), Decimal("40")) == PaymentStatus.PARTIAL
    assert payment_status_for(Decimal("100"), Decimal("100")) == PaymentStatus.PAID
    assert payment_status_for(Decimal("0"), Decimal("0")) == PaymentStatus.PAID


@pytest.mark.django_db
def test_paying_a_draft_invoice_keeps_its_document_status(pilot):  # noqa: F811
    """La factura del piloto nace en borrador (folio pendiente) y se paga completa."""
    invoice = Invoice.objects.get(pk=pilot["invoice"].pk)
    order = SaleOrder.objects.get(pk=pilot["order"].pk)

    assert invoice.status == Invoice.Status.DRAFT, "pagar no emite ni 'paga' el documento"
    assert invoice.payment_status == PaymentStatus.PAID
    assert order.status == SaleOrder.Status.CONFIRMED
    assert order.payment_status == PaymentStatus.PAID


@pytest.mark.django_db
def test_list_filter_by_payment_status(pilot):  # noqa: F811
    unpaid = SaleOrder.objects.create(customer=pilot["order"].customer, date=pilot["order"].date,
                                      status=SaleOrder.Status.CONFIRMED, total=Decimal("1000"))
    qs = SaleOrder.objects.all()
    assert set(filter_by_payment_status(qs, "success").values_list("pk", flat=True)) >= {pilot["order"].pk}
    assert unpaid.pk in set(filter_by_payment_status(qs, "neutral").values_list("pk", flat=True))
    assert pilot["order"].pk not in set(filter_by_payment_status(qs, "neutral").values_list("pk", flat=True))
    assert filter_by_payment_status(qs, "bogus").count() == qs.count()


@pytest.mark.parametrize("paid_before, amount, expected_calls", [
    (Decimal("600"), Decimal("400"), 1),   # este pago completa la OC → avanza la suscripción
    (Decimal("1000"), Decimal("100"), 0),  # ya estaba pagada → no avanza dos veces
    (Decimal("0"), Decimal("400"), 0),     # sigue con saldo
])
def test_purchase_order_fully_paid_hook_only_on_crossing(paid_before, amount, expected_calls):
    from types import SimpleNamespace
    from unittest.mock import MagicMock, patch

    from treasury.services import TreasuryService

    order = MagicMock()
    order._meta.model_name = "purchaseorder"
    order.total_paid = paid_before + amount
    order.effective_total = Decimal("1000")
    order.total = Decimal("1000")
    movement = SimpleNamespace(amount=amount)

    with patch("workflow.services.WorkflowService.sync_hub_tasks"):
        TreasuryService.update_related_document_status(movement, purchase_order=order)

    assert order.on_fully_paid.call_count == expected_calls
    order.save.assert_not_called()  # ADR-0084: el pago no escribe el estado


@pytest.mark.django_db
def test_invoice_list_filters_by_payment_status(pilot):  # noqa: F811
    client = pilot["client"]
    paid = client.get("/api/billing/invoices/", {"payment_status": "PAID"})
    unpaid = client.get("/api/billing/invoices/", {"payment_status": "UNPAID"})
    assert paid.status_code == 200 and unpaid.status_code == 200
    rows = lambda res: res.data["results"] if isinstance(res.data, dict) else res.data  # noqa: E731
    assert pilot["invoice"].id in {r["id"] for r in rows(paid)}
    assert pilot["invoice"].id not in {r["id"] for r in rows(unpaid)}
    assert {r["payment_status"] for r in rows(paid)} == {"PAID"}
