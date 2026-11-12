"""ADR-0132: el primer socio se crea con una suscripción (reemplaza a la «configuración inicial»)."""

from datetime import date
from decimal import Decimal

import pytest

from accounting.models import Account, AccountingSettings, AccountType
from contacts.models import Contact
from contacts.partner_models import PartnerEquityStake, PartnerTransaction
from contacts.partner_service import PartnerService

pytestmark = pytest.mark.django_db


def _configure():
    settings = AccountingSettings.get_solo()
    settings.partner_capital_social_account = Account.objects.create(
        name="Capital Social", code="3.1.01.900", account_type=AccountType.EQUITY
    )
    settings.partner_capital_receivable_account = Account.objects.create(
        name="Aportes por cobrar", code="1.1.09.900", account_type=AccountType.ASSET
    )
    settings.save()


def test_subscribing_a_plain_contact_makes_them_partner_with_subscribed_capital():
    _configure()
    contact = Contact.objects.create(name="Primera Socia", tax_id="11111111-1")
    assert not contact.is_partner

    ptx = PartnerService.handle_equity_movement_from_payload(
        {"contact_id": contact.id, "amount": "1000000", "type": "SUBSCRIPTION", "date": date(2026, 1, 1)},
        user=None,
    )

    contact.refresh_from_db()
    assert contact.is_partner
    assert contact.partner_since == date(2026, 1, 1)
    assert ptx.transaction_type == PartnerTransaction.Type.EQUITY_SUBSCRIPTION
    # La participación se mide sobre capital pagado (partner_net_equity): suscribir no la mueve.
    assert contact.partner_total_contributions == Decimal("1000000")
    stake = PartnerEquityStake.objects.get(partner=contact, effective_until__isnull=True)
    assert stake.percentage == Decimal("0.00")
    entry = ptx.journal_entry
    entry.check_balance()
    assert sum(i.debit for i in entry.items.all()) == Decimal("1000000")
