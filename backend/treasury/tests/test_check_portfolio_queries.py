"""Cartera y cheques en tránsito: el serializer lee sale_order por cheque; debe venir precargado."""

from datetime import date
from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from contacts.models import Contact
from sales.models import SaleOrder
from rest_framework.test import APIClient

from core.models import User
from treasury.models import Bank, Check, TreasuryAccount


@pytest.fixture
def api_client(db):
    client = APIClient(HTTP_HOST="localhost")
    client.force_authenticate(user=User.objects.create_superuser("chkq", "chkq@test.com", "pass"))
    return client


def _checks(n, bank, contact, status):
    portfolio = TreasuryAccount.objects.filter(account_type=TreasuryAccount.Type.CHECK_PORTFOLIO).first()
    if portfolio is None:
        portfolio = TreasuryAccount.objects.create(name="Cheques en cartera", account_type=TreasuryAccount.Type.CHECK_PORTFOLIO)
    for i in range(n):
        order = SaleOrder.objects.create(
            customer=contact, date=date(2026, 8, 1), total=Decimal("100"), status=SaleOrder.Status.CONFIRMED
        )
        Check.objects.create(
            direction=Check.Direction.RECEIVED,
            status=status,
            bank=bank,
            check_number=f"{status}-{i}-{order.pk}",
            amount=Decimal("100"),
            issue_date=date(2026, 8, 1),
            due_date=date(2026, 9, 1),
            drawer_name="Girador",
            portfolio_account=portfolio,
            sale_order=order,
        )


def _measure(api_client, url):
    with CaptureQueriesContext(connection) as ctx:
        response = api_client.get(url)
    assert response.status_code == 200
    return len(ctx.captured_queries)


@pytest.mark.django_db
@pytest.mark.parametrize("url_name, status", [("portfolio", Check.Status.IN_PORTFOLIO), ("in_transit", Check.Status.DEPOSITED)])
def test_queries_do_not_grow_with_checks_linked_to_orders(api_client, url_name, status):
    bank = Bank.objects.create(name="Banco cartera")
    contact = Contact.objects.create(name="Cliente cheques", tax_id="CHK-1")
    url = f"/api/treasury/checks/{url_name}/"

    _checks(2, bank, contact, status)
    small = _measure(api_client, url)
    _checks(6, bank, contact, status)
    large = _measure(api_client, url)

    assert large == small
