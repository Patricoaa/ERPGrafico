"""
P1-10: servicios de presupuesto y cierre de ejercicio — balances de P&L y
balance general en una consulta agrupada, reporte de ejecución y árbol de
variaciones sin N+1 por nodo.
"""

from datetime import date
from decimal import Decimal

import pytest

from accounting.fiscal_year_service import FiscalYearClosingService
from accounting.models import (
    Account,
    AccountingSettings,
    AccountType,
    Budget,
    BudgetItem,
    FiscalYear,
    JournalEntry,
    JournalItem,
)
from accounting.services import BudgetService
from tax.models import AccountingPeriod


@pytest.fixture
def user(db):
    from django.contrib.auth import get_user_model

    return get_user_model().objects.create_user(username="admin1", password="x")


@pytest.mark.django_db
def test_execution_report_bounded_queries(django_assert_max_num_queries):
    budget = Budget.objects.create(name="Presupuesto", start_date=date(2026, 1, 1), end_date=date(2026, 12, 31))
    income = Account.objects.create(name="Ventas", code="4.1.01", account_type=AccountType.INCOME)
    expense = Account.objects.create(name="Gastos", code="5.1.01", account_type=AccountType.EXPENSE)
    BudgetItem.objects.create(budget=budget, account=income, year=2026, month=6, amount=Decimal("1000"))
    BudgetItem.objects.create(budget=budget, account=expense, year=2026, month=6, amount=Decimal("500"))

    entry = JournalEntry.objects.create(
        date=date(2026, 6, 15), description="Ops", status=JournalEntry.Status.POSTED
    )
    JournalItem.objects.create(entry=entry, account=income, debit=Decimal("0"), credit=Decimal("1200"))
    JournalItem.objects.create(entry=entry, account=expense, debit=Decimal("300"), credit=Decimal("0"))

    with django_assert_max_num_queries(6):
        report = BudgetService.get_execution_report(budget)

    by_code = {i["account_code"]: i for i in report["items"]}
    assert by_code["4.1.01"]["budgeted"] == 1000.0
    assert by_code["4.1.01"]["actual"] == 1200.0
    assert by_code["5.1.01"]["actual"] == 300.0
    assert report["summary"]["total_budgeted"] == 1500.0
    assert report["summary"]["total_actual"] == 1500.0


@pytest.mark.django_db
def test_variance_report_tree_shape_and_bounded_queries(django_assert_max_num_queries):
    group = Account.objects.create(name="Resultado", code="4", account_type=AccountType.INCOME)
    child = Account.objects.create(
        name="Ventas", code="4.1", account_type=AccountType.INCOME, parent=group
    )
    budget = Budget.objects.create(name="Presupuesto", start_date=date(2026, 1, 1), end_date=date(2026, 12, 31))
    BudgetItem.objects.create(budget=budget, account=child, year=2026, month=7, amount=Decimal("500"))

    entry = JournalEntry.objects.create(
        date=date(2026, 7, 10), description="Ops", status=JournalEntry.Status.POSTED
    )
    JournalItem.objects.create(entry=entry, account=child, debit=Decimal("0"), credit=Decimal("600"))

    with django_assert_max_num_queries(12):
        tree = BudgetService.get_variance_report(budget, 2026, 7)

    root = tree[0]
    assert root["id"] == group.id
    assert len(root["children"]) == 1
    leaf = root["children"][0]
    assert leaf["month_actual"] == 600.0
    assert leaf["month_budget"] == 500.0
    assert leaf["month_variance"] == 100.0
    assert leaf["month_percentage"] == 120.0
    assert root["month_actual"] == 600.0
    assert root["month_budget"] == 500.0


@pytest.mark.django_db
def test_pl_account_balances_bounded_queries(django_assert_max_num_queries):
    acc1 = Account.objects.create(name="Ventas A", code="4.1.01", account_type=AccountType.INCOME)
    acc2 = Account.objects.create(name="Ventas B", code="4.1.02", account_type=AccountType.INCOME)
    expense = Account.objects.create(name="Gastos", code="5.1.01", account_type=AccountType.EXPENSE)
    entry = JournalEntry.objects.create(
        date=date(2026, 6, 15), description="Ops", status=JournalEntry.Status.POSTED
    )
    JournalItem.objects.create(entry=entry, account=acc1, debit=Decimal("0"), credit=Decimal("400"))
    JournalItem.objects.create(entry=entry, account=acc2, debit=Decimal("0"), credit=Decimal("150"))
    JournalItem.objects.create(entry=entry, account=expense, debit=Decimal("100"), credit=Decimal("0"))

    with django_assert_max_num_queries(4):
        income = FiscalYearClosingService._get_pl_account_balances(
            AccountType.INCOME, date(2026, 1, 1), date(2026, 12, 31)
        )

    by_code = {a["code"]: a["balance"] for a in income}
    assert by_code == {"4.1.01": 400.0, "4.1.02": 150.0}

    with django_assert_max_num_queries(4):
        expenses = FiscalYearClosingService._get_pl_account_balances(
            AccountType.EXPENSE, date(2026, 1, 1), date(2026, 12, 31)
        )
    assert {a["code"]: a["balance"] for a in expenses} == {"5.1.01": 100.0}


@pytest.mark.django_db
def test_generate_opening_entry_bounded_queries(user, django_assert_max_num_queries):
    from django.core.cache import cache

    cache.clear()

    settings = AccountingSettings.get_solo()
    settings.partner_current_year_earnings_account = Account.objects.create(
        name="Utilidad del Ejercicio", code="3.4.01", account_type=AccountType.EQUITY
    )
    settings.partner_retained_earnings_account = Account.objects.create(
        name="Resultados Acumulados", code="3.4.02", account_type=AccountType.EQUITY
    )
    settings.save()

    asset1 = Account.objects.create(name="Caja", code="1.1.01", account_type=AccountType.ASSET)
    asset2 = Account.objects.create(name="Banco", code="1.1.02", account_type=AccountType.ASSET)
    capital = Account.objects.create(name="Capital", code="3.1.01", account_type=AccountType.EQUITY)
    entry = JournalEntry.objects.create(
        date=date(2026, 12, 20), description="Ops", status=JournalEntry.Status.POSTED
    )
    JournalItem.objects.create(entry=entry, account=asset1, debit=Decimal("300"), credit=Decimal("0"))
    JournalItem.objects.create(entry=entry, account=asset2, debit=Decimal("200"), credit=Decimal("0"))
    JournalItem.objects.create(entry=entry, account=capital, debit=Decimal("0"), credit=Decimal("500"))

    AccountingPeriod.objects.create(year=2027, month=1)
    fiscal_year = FiscalYear.objects.create(
        year=2026,
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
        status=FiscalYear.Status.CLOSED,
    )

    with django_assert_max_num_queries(39):
        result = FiscalYearClosingService.generate_opening_entry(2026, user)

    assert result.id == fiscal_year.id
    result.refresh_from_db()
    assert result.opening_entry is not None
    item_accounts = {i.account_id for i in result.opening_entry.items.all()}
    assert asset1.id in item_accounts
    assert asset2.id in item_accounts
