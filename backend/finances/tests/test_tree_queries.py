from datetime import date
from decimal import Decimal

import pytest

from accounting.models import (
    Account,
    FiscalYear,
    ISCategory,
    JournalEntry,
    JournalItem,
)
from accounting.services import AccountingService
from finances.services import FinanceService


@pytest.fixture
def fin_data(db):
    AccountingService.populate_ifrs_coa()
    accounts = {a.code: a for a in Account.objects.all()}
    assert "1.1.01.01" in accounts

    def mk(date_, description, items):
        entry = JournalEntry.objects.create(
            date=date_, description=description, status=JournalEntry.Status.POSTED
        )
        for code, debit, credit in items:
            JournalItem.objects.create(
                entry=entry,
                account=accounts[code],
                debit=Decimal(debit),
                credit=Decimal(credit),
            )
        return entry

    mk(
        date(2026, 1, 15),
        "Aporte capital",
        [("1.1.01.02", "50000000", "0"), ("3.1.01", "0", "50000000")],
    )
    mk(
        date(2026, 2, 10),
        "Venta productos",
        [("1.1.02.01", "1000000", "0"), ("4.1.01", "0", "1000000")],
    )
    mk(
        date(2026, 2, 20),
        "Compra maquinaria",
        [("1.2.01.01", "2000000", "0"), ("1.1.01.02", "0", "2000000")],
    )
    mk(
        date(2026, 3, 5),
        "Venta servicios",
        [("1.1.01.01", "500000", "0"), ("4.1.02", "0", "500000")],
    )
    mk(
        date(2026, 3, 15),
        "Compra inventario",
        [("1.1.03.01", "400000", "0"), ("2.1.01.01", "0", "400000")],
    )
    mk(
        date(2026, 4, 1),
        "Costo de ventas",
        [("5.1.01", "600000", "0"), ("1.1.03.01", "0", "600000")],
    )
    mk(
        date(2026, 5, 20),
        "Sueldos",
        [("5.2.01.01", "300000", "0"), ("2.1.03.01", "0", "300000")],
    )
    mk(
        date(2026, 6, 10),
        "Arriendo",
        [("5.2.02", "200000", "0"), ("1.1.01.01", "0", "200000")],
    )
    return accounts


@pytest.fixture
def fiscal_year_2026(db):
    return FiscalYear.objects.create(
        year=2026,
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
        status=FiscalYear.Status.OPEN,
    )


def _node_by_code(tree, code):
    for node in tree:
        if node["code"] == code:
            return node
        found = _node_by_code(node["children"], code)
        if found:
            return found
    return None


@pytest.mark.django_db
def test_balance_sheet_single_pass(fin_data, django_assert_max_num_queries):
    with django_assert_max_num_queries(12):
        bs = FinanceService.get_balance_sheet(end_date=date(2026, 6, 30))
    assert bs["total_assets"] == 51100000.0
    assert bs["total_liabilities"] == 700000.0
    assert bs["total_equity"] == 50400000.0
    assert bs["check"] == 0.0
    banco = _node_by_code(bs["assets"], "1.1.01.02")
    assert banco is not None
    assert banco["balance"] == 48000000.0
    assert _node_by_code(bs["equity"], "3.1.01")["balance"] == 50000000.0


@pytest.mark.django_db
def test_income_statement_single_pass(fin_data, django_assert_max_num_queries):
    with django_assert_max_num_queries(12):
        isr = FinanceService.get_income_statement(date(2026, 1, 1), date(2026, 6, 30))
    totals = {s["name"]: s["total"] for s in isr["sections"]}
    assert totals["Ingresos Operacionales"] == 1500000.0
    assert totals["Costo de Ventas"] == 600000.0
    assert totals["Resultado Bruto"] == 900000.0
    assert totals["Gastos Operacionales"] == 500000.0
    assert totals["Resultado Operacional"] == 400000.0
    assert isr["net_income"] == 400000.0


@pytest.mark.django_db
def test_cash_flow_single_pass(fin_data, django_assert_max_num_queries):
    with django_assert_max_num_queries(25):
        cf = FinanceService.get_cash_flow(date(2026, 1, 1), date(2026, 6, 30))
    assert cf["beginning_cash"] == 0.0
    assert cf["ending_cash"] == 48300000.0
    assert cf["discrepancy"] == 0.0
    assert cf["is_balanced"] is True
    operating = {x["name"]: x["amount"] for x in cf["operating"]}
    assert operating["Cambio en Deudores Comerciales"] == -1000000.0
    assert cf["investing"][0]["amount"] == -2000000.0
    assert cf["financing"][0]["amount"] == 50000000.0


@pytest.mark.django_db
def test_trial_balance_single_pass(fin_data, django_assert_max_num_queries):
    with django_assert_max_num_queries(8):
        tb = FinanceService.get_trial_balance(date(2026, 1, 1), date(2026, 6, 30))
    assert tb["total_debit"] == 55000000.0
    assert tb["total_credit"] == 55000000.0
    assert tb["total_saldo_deudor"] == 52400000.0
    assert tb["total_saldo_acreedor"] == 52400000.0


@pytest.mark.django_db
def test_financial_analysis_single_pass(fin_data, django_assert_max_num_queries):
    with django_assert_max_num_queries(25):
        fa = FinanceService.get_financial_analysis(date(2026, 1, 1), date(2026, 6, 30))
    assert fa["structure"]["total_assets"] == 51100000.0
    assert fa["liquidity"]["current_assets"] == 49100000.0
    assert fa["liquidity"]["current_liabilities"] == 700000.0
    assert fa["profitability"]["net_income"] == 400000.0


@pytest.mark.django_db
def test_fiscal_year_mapping_routes_revenue(fin_data, fiscal_year_2026, django_assert_max_num_queries):
    from accounting.models import FiscalYearAccountMapping

    FiscalYearAccountMapping.objects.create(
        fiscal_year=fiscal_year_2026,
        account=fin_data["4.1.01"],
        is_category=ISCategory.NON_OPERATING_REVENUE,
    )
    with django_assert_max_num_queries(15):
        isr = FinanceService.get_income_statement(
            date(2026, 1, 1), date(2026, 6, 30), fiscal_year_id=fiscal_year_2026.id
        )
    totals = {s["name"]: s["total"] for s in isr["sections"]}
    assert totals["Ingresos Operacionales"] == 0.0
    non_op = next(s for s in isr["sections"] if s["name"] == "Ingresos No Operacionales")
    assert non_op["total"] == 1000000.0
    assert any(
        n["name"] == "Venta de Productos" and n["balance"] == 1000000.0
        for n in non_op["tree"]
    )


@pytest.mark.django_db
def test_comparative_balances_single_pass(fin_data, django_assert_max_num_queries):
    with django_assert_max_num_queries(15):
        bs = FinanceService.get_balance_sheet(
            end_date=date(2026, 6, 30),
            comp_start=date(2026, 1, 1),
            comp_end=date(2026, 3, 31),
        )
    assert bs["total_assets"] == 51100000.0
    assert bs["total_assets_comp"] == 51900000.0
    assert bs["total_liabilities_comp"] == 400000.0
    assert bs["total_equity_comp"] == 51500000.0
    assert bs["check_comp"] == 0.0
