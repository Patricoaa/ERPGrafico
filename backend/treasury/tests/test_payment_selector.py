"""
GAP-04(a) (auditoría documental): un único cálculo de "pagado" para factura,
OV y OC, compartido por modelos y serializers.

Antes: `Invoice.total_paid` usaba `TreasuryMovement.Status` (no existe) y
fallaba con cualquier pago; OV/OC sumaban pagos anulados y sumaban las
devoluciones como si fueran pagos.
"""

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model

from accounting.models import Account, AccountType
from billing.models import Invoice
from billing.serializers import InvoiceSerializer
from contacts.models import Contact
from inventory.models import Warehouse
from purchasing.models import PurchaseOrder
from sales.models import SaleOrder
from treasury.models import TreasuryAccount, TreasuryMovement

User = get_user_model()
INBOUND, OUTBOUND = TreasuryMovement.Type.INBOUND, TreasuryMovement.Type.OUTBOUND
CANCELLED = TreasuryMovement.MovementStatus.CANCELLED


@pytest.fixture
def env(db):
    user = User.objects.create_user(username="paidsel", password="x")
    acc = Account.objects.create(name="Caja", code="1.1.01.009", account_type=AccountType.ASSET)
    ta = TreasuryAccount.objects.create(name="Caja", account=acc, account_type=TreasuryAccount.Type.CASH)
    contact = Contact.objects.create(name="Cliente Pagos", tax_id="11111111-1")
    return {"user": user, "ta": ta, "contact": contact}


def _mov(env, movement_type, amount, **kw):
    account = {"to_account": env["ta"]} if movement_type == INBOUND else {"from_account": env["ta"]}
    return TreasuryMovement.objects.create(
        movement_type=movement_type, amount=Decimal(amount), created_by=env["user"],
        contact=env["contact"], **account, **kw,
    )


@pytest.mark.django_db
def test_sale_order_and_invoice_share_signed_paid_amount(env):
    order = SaleOrder.objects.create(customer=env["contact"], date=date(2026, 10, 1))
    invoice = Invoice.objects.create(
        dte_type=Invoice.DTEType.FACTURA, contact=env["contact"], sale_order=order,
        total=Decimal("1000"),
    )
    link = {"sale_order": order, "invoice": invoice}
    _mov(env, INBOUND, "600", **link)
    _mov(env, INBOUND, "300", status=CANCELLED, **link)  # anulado: no cuenta
    _mov(env, OUTBOUND, "100", **link)  # devolución: resta

    assert order.total_paid == Decimal("500")
    assert invoice.total_paid == Decimal("500")
    assert invoice.pending_amount == Decimal("500")
    assert Decimal(str(InvoiceSerializer(invoice).data["pending_amount"])) == Decimal("500")


@pytest.mark.django_db
def test_purchase_order_signs_outbound_as_paid_and_skips_note_payments(env):
    warehouse = Warehouse.objects.create(name="Bodega", code="WH-PS")
    po = PurchaseOrder.objects.create(
        number="PO-PS", supplier=env["contact"], warehouse=warehouse, total=0, total_net=0, total_tax=0
    )
    note = Invoice.objects.create(
        dte_type=Invoice.DTEType.NOTA_CREDITO, contact=env["contact"], purchase_order=po,
        total=Decimal("50"),
    )
    _mov(env, OUTBOUND, "800", purchase_order=po)
    _mov(env, INBOUND, "200", purchase_order=po)  # reembolso del proveedor: resta
    _mov(env, INBOUND, "50", purchase_order=po, invoice=note)  # pago de la NC: fuera del saldo de la OC

    assert po.total_paid == Decimal("600")


@pytest.mark.django_db
def test_payment_return_on_sale_order_lowers_paid_without_crashing(env):
    """
    Antes `register_payment_return` asignaba `sale_order.pending_amount`, una
    propiedad sin setter → AttributeError y rollback de toda la devolución.
    """
    from accounting.models import AccountingSettings
    from treasury.return_services import TreasuryReturnService

    receivable = Account.objects.create(name="Clientes", code="1.1.03.009", account_type=AccountType.ASSET)
    settings = AccountingSettings.get_solo()
    settings.default_receivable_account = receivable
    settings.save()

    order = SaleOrder.objects.create(customer=env["contact"], date=date(2026, 10, 1))
    payment = _mov(env, INBOUND, "600", sale_order=order)

    TreasuryReturnService.register_payment_return(payment, Decimal("200"), reason="test")

    order.refresh_from_db()
    assert order.total_paid == Decimal("400")


@pytest.mark.django_db
def test_movement_is_distributed_once_between_fk_and_allocations(env):
    """M4d: un pago con FK a la factura A e imputaciones no se cuenta dos veces."""
    from treasury.models import PaymentAllocation

    order = SaleOrder.objects.create(customer=env["contact"], date=date(2026, 10, 1))
    inv_a = Invoice.objects.create(dte_type=Invoice.DTEType.FACTURA, contact=env["contact"], sale_order=order,
                                   total=Decimal("1000"))
    inv_b = Invoice.objects.create(dte_type=Invoice.DTEType.FACTURA, contact=env["contact"], sale_order=order,
                                   total=Decimal("1000"))
    payment = _mov(env, INBOUND, "1000", invoice=inv_a, sale_order=order)

    PaymentAllocation.objects.create(treasury_movement=payment, invoice=inv_a, amount=Decimal("600"))
    PaymentAllocation.objects.create(treasury_movement=payment, invoice=inv_b, amount=Decimal("400"))

    assert inv_a.total_paid == Decimal("600")
    assert inv_b.total_paid == Decimal("400")
    assert order.total_paid == Decimal("1000"), "en la orden el pago cuenta una vez"


@pytest.mark.django_db
def test_status_update_ignores_cancelled_payments(env):
    """M4d: update_related_document_status usaba la suma bruta (anulados incluidos) para marcar PAGADA."""
    from treasury.services import TreasuryService

    invoice = Invoice.objects.create(dte_type=Invoice.DTEType.FACTURA, contact=env["contact"],
                                     total=Decimal("1000"), status=Invoice.Status.POSTED)
    _mov(env, INBOUND, "1000", invoice=invoice, status=CANCELLED)
    live = _mov(env, INBOUND, "500", invoice=invoice)

    TreasuryService.update_related_document_status(live, invoice=invoice)

    invoice.refresh_from_db()
    assert invoice.status == Invoice.Status.POSTED
