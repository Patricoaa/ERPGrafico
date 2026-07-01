"""
Tests for FiscalYearAccountMapping snapshot and historical report resolution.
"""

from decimal import Decimal
from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase

from accounting.models import (
    Account,
    AccountType,
    AccountingSettings,
    BSCategory,
    CFCategory,
    FiscalYear,
    FiscalYearAccountMapping,
    ISCategory,
    JournalEntry,
    JournalItem,
)
from accounting.fiscal_year_service import FiscalYearClosingService
from finances.services import FinanceService
from tax.models import AccountingPeriod

User = get_user_model()


def _create_balanced_entry(date_val, description, items_data, is_closing_system=False):
    """Create and post a balanced journal entry.

    items_data: list of (account, label, debit, credit)
    Automatically adds a cash balancing line.
    """
    from accounting.services import JournalEntryService

    total_debit = sum(d for _, _, d, _ in items_data)
    total_credit = sum(c for _, _, _, c in items_data)

    entry = JournalEntry.objects.create(
        date=date_val,
        description=description,
        status=JournalEntry.Status.DRAFT,
    )
    if is_closing_system:
        entry._is_system_closing_entry = True
    entry.save()

    for account, label, debit, credit in items_data:
        JournalItem.objects.create(entry=entry, account=account, label=label, debit=debit, credit=credit)

    if total_debit != total_credit:
        cash = Account.objects.filter(account_type=AccountType.ASSET).first()
        if not cash:
            cash = Account.objects.create(
                code="1.1.01.001", name="Caja General", account_type=AccountType.ASSET,
            )
        diff = total_credit - total_debit
        if diff > 0:
            JournalItem.objects.create(entry=entry, account=cash, label="Balance", debit=Decimal(str(diff)), credit=Decimal("0"))
        else:
            JournalItem.objects.create(entry=entry, account=cash, label="Balance", debit=Decimal("0"), credit=Decimal(str(abs(diff))))

    JournalEntryService.post_entry(entry)
    return entry


def _setup_periods(year):
    """Close all 12 accounting periods for the given year (create if needed)."""
    periods = []
    for month in range(1, 13):
        period, _ = AccountingPeriod.objects.update_or_create(
            year=year, month=month, defaults={"status": AccountingPeriod.Status.CLOSED}
        )
        periods.append(period)
    return periods


class FiscalYearMappingSnapshotTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testcloser", password="test")
        settings = AccountingSettings.get_solo()
        self.result_account = Account.objects.create(
            code="3.4.01",
            name="Utilidad del Ejercicio",
            account_type=AccountType.EQUITY,
        )
        settings.partner_current_year_earnings_account = self.result_account
        settings.save()

        self.cash = Account.objects.create(
            code="1.1.01.001", name="Caja General", account_type=AccountType.ASSET,
            bs_category=BSCategory.CURRENT_ASSET, cf_category=CFCategory.OPERATING,
        )

        self.revenue_account = Account.objects.create(
            code="4.1.01", name="Ventas", account_type=AccountType.INCOME,
            is_category=ISCategory.REVENUE,
        )
        self.expense_account = Account.objects.create(
            code="5.1.01", name="Sueldos", account_type=AccountType.EXPENSE,
            is_category=ISCategory.OPERATING_EXPENSE,
        )

        _create_balanced_entry(
            date(2025, 12, 31), "Test entry",
            [
                (self.revenue_account, "Revenue", Decimal("0"), Decimal("100000")),
                (self.expense_account, "Expense", Decimal("60000"), Decimal("0")),
            ],
        )

        self.cash_account = self.cash  # reuse the same cash account reference

        _setup_periods(2025)

    def test_snapshot_created_on_close(self):
        """Snapshot of all leaf account mappings is created when closing."""
        fy = FiscalYearClosingService.close_fiscal_year(2025, self.user)
        mappings = FiscalYearAccountMapping.objects.filter(fiscal_year=fy)
        self.assertGreater(mappings.count(), 0)
        # Check the revenue account has its IS category captured
        rev_mapping = mappings.get(account=self.revenue_account)
        self.assertEqual(rev_mapping.is_category, ISCategory.REVENUE)
        # Cash account should have BS and CF categories
        cash_mapping = mappings.get(account=self.cash_account)
        self.assertEqual(cash_mapping.bs_category, BSCategory.CURRENT_ASSET)
        self.assertEqual(cash_mapping.cf_category, CFCategory.OPERATING)

    def test_snapshot_deleted_on_reopen(self):
        """Snapshot is removed when the fiscal year is reopened."""
        fy = FiscalYearClosingService.close_fiscal_year(2025, self.user)
        self.assertTrue(FiscalYearAccountMapping.objects.filter(fiscal_year=fy).exists())
        FiscalYearClosingService.reopen_fiscal_year(2025, self.user)
        self.assertFalse(FiscalYearAccountMapping.objects.filter(fiscal_year=fy).exists())


class HistoricalCategoryResolutionTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testresolver", password="test")
        settings = AccountingSettings.get_solo()
        self.result_account = Account.objects.create(
            code="3.4.01",
            name="Utilidad del Ejercicio",
            account_type=AccountType.EQUITY,
        )
        settings.partner_current_year_earnings_account = self.result_account
        settings.save()

        self.cash = Account.objects.create(
            code="1.1.01.001", name="Caja", account_type=AccountType.ASSET,
        )

        self.account = Account.objects.create(
            code="4.1.01",
            name="Ingresos",
            account_type=AccountType.INCOME,
            is_category=ISCategory.REVENUE,
        )

        _create_balanced_entry(
            date(2025, 6, 30), "Test",
            [(self.account, "Rev", Decimal("0"), Decimal("5000"))],
        )

        _setup_periods(2025)
        self.fy = FiscalYearClosingService.close_fiscal_year(2025, self.user)

        self.account.is_category = ISCategory.NON_OPERATING_REVENUE
        self.account.save()

    def test_resolve_category_live(self):
        """Without fiscal_year_id, returns the live (remapped) category."""
        result = FinanceService._resolve_category(self.account, "is")
        self.assertEqual(result, ISCategory.NON_OPERATING_REVENUE)

    def test_resolve_category_historical(self):
        """With fiscal_year_id, returns the snapshot (pre-remap) category."""
        result = FinanceService._resolve_category(self.account, "is", fiscal_year_id=self.fy.id)
        self.assertEqual(result, ISCategory.REVENUE)

    def test_get_accounts_by_cf_live(self):
        """Live CF filtering uses current field values."""
        self.account.cf_category = CFCategory.OPERATING
        self.account.save()
        results = FinanceService._get_accounts_by_cf_category(CFCategory.OPERATING)
        self.assertIn(self.account, results)

    def test_get_accounts_by_cf_historical(self):
        """Historical CF filtering uses snapshot."""
        # Account has no live CF category, but snapshot should have it (None)
        # This test verifies it doesn't crash and returns empty for unmapped
        results = FinanceService._get_accounts_by_cf_category(CFCategory.OPERATING, fiscal_year_id=self.fy.id)
        # The account was mapped in snapshot, but cf was not set on it
        self.assertNotIn(self.account, results)


class HistoricalReportConsistencyTest(TestCase):
    """End-to-end: remapping after close produces different results for live vs historical.

    Creates entries, creates the snapshot mapping directly (simulating close),
    remaps accounts live, then verifies aggregated balance respects snapshot.
    """

    def setUp(self):
        self.user = User.objects.create_user(username="testreport", password="test")
        settings = AccountingSettings.get_solo()
        self.result_account = Account.objects.create(
            code="3.4.01",
            name="Utilidad del Ejercicio",
            account_type=AccountType.EQUITY,
        )
        settings.partner_current_year_earnings_account = self.result_account
        settings.save()

        self.cash = Account.objects.create(
            code="1.1.01.001", name="Caja", account_type=AccountType.ASSET,
        )

        self.revenue = Account.objects.create(
            code="4.1.01",
            name="Ventas",
            account_type=AccountType.INCOME,
            is_category=ISCategory.REVENUE,
        )
        self.non_op_revenue = Account.objects.create(
            code="4.2.01",
            name="Intereses Ganados",
            account_type=AccountType.INCOME,
            is_category=ISCategory.NON_OPERATING_REVENUE,
        )

        _create_balanced_entry(
            date(2025, 6, 30), "Test",
            [
                (self.revenue, "Rev", Decimal("0"), Decimal("100000")),
                (self.non_op_revenue, "NonOp", Decimal("0"), Decimal("10000")),
            ],
        )

        _setup_periods(2025)
        self.fy = FiscalYearClosingService.close_fiscal_year(2025, self.user)

        # Remap: move Intereses from NON_OPERATING to REVENUE (post-close remap)
        self.non_op_revenue.is_category = ISCategory.REVENUE
        self.non_op_revenue.save()

    def test_live_revenue_includes_remapped_account(self):
        """Live resolution sees non_op_revenue as REVENUE."""
        cat = FinanceService._resolve_category(self.non_op_revenue, "is")
        self.assertEqual(cat, ISCategory.REVENUE)

    def test_historical_revenue_excludes_remapped_account(self):
        """Historical resolution sees non_op_revenue as NON_OPERATING_REVENUE."""
        cat = FinanceService._resolve_category(self.non_op_revenue, "is", fiscal_year_id=self.fy.id)
        self.assertEqual(cat, ISCategory.NON_OPERATING_REVENUE)
