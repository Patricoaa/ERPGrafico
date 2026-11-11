"""Relaciones documentales Caja POS ↔ sesiones POS."""

import pytest
from django.contrib.auth import get_user_model

from treasury.models import POSTerminal
from treasury.relations import pos_session_relations, pos_terminal_relations
from treasury.tests.helpers import make_pos_session

User = get_user_model()


@pytest.mark.django_db
def test_terminal_lists_all_its_sessions_newest_first():
    user = User.objects.create_user(username="cajero", password="x")
    terminal = POSTerminal.objects.create(name="Mostrador", code="T-1")
    other = POSTerminal.objects.create(name="Bodega", code="T-2")
    first = make_pos_session(user, terminal=terminal)
    second = make_pos_session(user, terminal=terminal)
    make_pos_session(user, terminal=other)

    links = list(pos_terminal_relations(terminal))

    assert [link.target for link in links] == [second, first]
    assert {link.role for link in links} == {"pos_session"}


@pytest.mark.django_db
def test_session_links_back_to_its_terminal():
    user = User.objects.create_user(username="cajero", password="x")
    terminal = POSTerminal.objects.create(name="Mostrador", code="T-1")
    session = make_pos_session(user, terminal=terminal)

    roles = {(link.role, link.target) for link in pos_session_relations(session)}

    assert ("pos_box", terminal) in roles


@pytest.mark.django_db
def test_session_links_sales_collected_in_it_even_if_born_elsewhere():
    from datetime import date
    from decimal import Decimal

    from contacts.models import Contact
    from sales.models import SaleOrder

    user = User.objects.create_user(username="cajero2", password="x")
    session = make_pos_session(user, terminal=POSTerminal.objects.create(name="M", code="T-9"))
    customer = Contact.objects.create(name="Cliente", tax_id="5-5")
    order = SaleOrder.objects.create(customer=customer, date=date(2026, 11, 1), status="CONFIRMED", total=Decimal("1000"))
    from treasury.models import TreasuryMovement

    TreasuryMovement.objects.create(
        movement_type="INBOUND", payment_method="CASH", amount=Decimal("1000"), sale_order=order,
        pos_session=session, created_by=user, date=date(2026, 11, 1),
    )

    links = {(link.role, link.target) for link in pos_session_relations(session)}

    assert ("pos_collected_sale", order) in links
