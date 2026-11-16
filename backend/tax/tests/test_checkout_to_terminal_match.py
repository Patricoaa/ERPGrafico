"""Integración: checkout POS real → ventas TUU → cuadre (ADR-0138 D3 + D4).

Usa los mismos fixtures del checkout de billing para que el 48 y el 39 salgan del
código real (no de fábricas), y comprueba que el cuadre enlaza cada venta TUU con
el documento de su porción.
"""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from billing.models import Invoice
from billing.tests.conftest import _any_account_is_cash, env  # noqa: F401 (fixtures)
from billing.tests.test_pos_checkout_documents import _alloc, _checkout, _order, pos  # noqa: F401
from core.fiscal_match import MatchStatus
from tax.reconciliation.terminal import reconcile_terminal_sales
from tax.tests.reconciliation_helpers import set_match_settings
from treasury.models import TerminalSale


def _terminal_sale(device, amount, at, payment_type, document_type, n):
    return TerminalSale.objects.create(
        provider=device.provider, device=device, natural_key=f"it-{n}",
        serial_number=device.serial_number, sale_id=f"IT{n}", sequence_number=str(n),
        transaction_at=at, status=TerminalSale.Status.COMPLETED, payment_type=payment_type,
        document_type=document_type, sale_amount=Decimal(amount), total_amount=Decimal(amount),
    )


@pytest.mark.django_db
def test_mixed_checkout_matches_each_portion(env, pos):  # noqa: F811
    today = timezone.localdate()
    set_match_settings(today - timedelta(days=1), window=15)
    order = _order(env)

    inv = _checkout(order, pos, payments=[_alloc(pos["card"], 6000), _alloc(pos["cash"], 4000)])

    docs = {d.dte_type: d for d in inv.checkout_documents}
    device = pos["card"].linked_terminal_device
    now = timezone.now()
    card = _terminal_sale(device, 6000, now + timedelta(minutes=2), TerminalSale.PaymentType.DEBIT, 48, 1)
    cash = _terminal_sale(device, 4000, now - timedelta(minutes=1), TerminalSale.PaymentType.CASH, 39, 2)

    result = reconcile_terminal_sales(today, today)

    card.refresh_from_db()
    cash.refresh_from_db()
    assert result == {MatchStatus.MATCHED: 2}
    assert card.match_status == MatchStatus.MATCHED
    assert card.matched_invoice_id == docs[Invoice.DTEType.COMPROBANTE_PAGO].id
    assert cash.match_status == MatchStatus.MATCHED
    assert cash.matched_invoice_id == docs[Invoice.DTEType.BOLETA].id
