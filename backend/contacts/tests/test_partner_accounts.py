"""Subcuentas por socio: una por socio bajo la cuenta global, sin nombres repetidos."""

import pytest

from accounting.models import Account, AccountType
from contacts.models import Contact
from contacts.partner_accounts import resolve_partner_account

pytestmark = pytest.mark.django_db


@pytest.fixture
def parent():
    return Account.objects.create(code="2.1.07", name="Dividendos por Pagar", account_type=AccountType.LIABILITY)


def _partner(name, tax_id):
    return Contact.objects.create(name=name, tax_id=tax_id, is_partner=True)


def test_creates_the_partner_subaccount_once(parent):
    ana = _partner("Ana", "11111111-1")

    first = resolve_partner_account(ana, parent)
    second = resolve_partner_account(ana, parent)

    assert first == second
    assert first.parent == parent
    assert first.name == "Dividendos por Pagar - Ana"
    assert first.is_selectable and not parent.is_selectable


def test_namesake_partners_get_distinct_accounts(parent):
    first_juan = _partner("Juan Pérez", "11111111-1")
    second_juan = _partner("Juan Pérez", "22222222-2")

    first = resolve_partner_account(first_juan, parent)
    second = resolve_partner_account(second_juan, parent)

    assert first != second
    assert first.name == "Dividendos por Pagar - Juan Pérez"
    assert second.name == f"Dividendos por Pagar - Juan Pérez ({second_juan.display_id})"
    # Cada socio vuelve a encontrar su propia subcuenta.
    assert resolve_partner_account(first_juan, parent) == first
    assert resolve_partner_account(second_juan, parent) == second


def test_finds_an_account_created_with_a_renamed_parent(parent):
    ana = _partner("Ana", "11111111-1")
    existing = resolve_partner_account(ana, parent)
    parent.name = "Dividendos Declarados"
    parent.save()

    assert resolve_partner_account(ana, parent) == existing


def test_execute_distribution_posts_to_partner_subaccounts():
    """Reproduce el 400 «tiene subcuentas»: el padre de dividendos ya tiene hijos (datos demo)."""
    from datetime import date
    from decimal import Decimal

    from accounting.models import AccountingSettings
    from contacts.partner_models import (
        ProfitDistributionLine,
        ProfitDistributionResolution,
    )
    from contacts.partner_models import (
        ProfitDistributionLineDestination as Dest,
    )
    from contacts.profit_distribution_service import ProfitDistributionService

    settings = AccountingSettings.get_solo()
    dividends = Account.objects.create(code="2.1.07", name="Dividendos por Pagar", account_type=AccountType.LIABILITY)
    Account.objects.create(code="2.1.07.001", name="Dividendos por Pagar - Socio A", account_type=AccountType.LIABILITY, parent=dividends)
    retained = Account.objects.create(code="3.2.01", name="Utilidades Retenidas", account_type=AccountType.EQUITY)
    Account.objects.create(code="3.2.01.001", name="Utilidades Retenidas - Socio A", account_type=AccountType.EQUITY, parent=retained)
    current = Account.objects.create(code="3.4.01", name="Resultado del Ejercicio", account_type=AccountType.EQUITY)
    settings.partner_dividends_payable_account = dividends
    settings.partner_retained_earnings_account = retained
    settings.partner_current_year_earnings_account = current
    settings.save()

    partner = _partner("Socio A", "11111111-1")
    resolution = ProfitDistributionResolution.objects.create(
        fiscal_year=2025, resolution_date=date(2026, 4, 30), net_result=Decimal("1000"),
        status=ProfitDistributionResolution.Status.APPROVED,
    )
    line = ProfitDistributionLine.objects.create(
        resolution=resolution, partner=partner, percentage_at_date=Decimal("100"),
        gross_amount=Decimal("1000"), net_amount=Decimal("1000"),
    )
    Dest.objects.create(line=line, destination=Dest.Destination.DIVIDEND_PAYABLE, amount=Decimal("600"))
    Dest.objects.create(line=line, destination=Dest.Destination.RETAINED, amount=Decimal("400"))

    ProfitDistributionService.execute_resolution(resolution, executed_by=None)

    items = resolution.journal_entry.items.filter(partner=partner)
    assert {item.account.parent for item in items} == {dividends, retained}
    assert all(item.account.is_selectable for item in items)
