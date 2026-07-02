"""
FiscalYearClosingService: Business logic for annual fiscal year closing.

Handles:
1. Preview of closing (what will happen)
2. Execute closing (generate closing journal entry)
3. Reopen (reverse closing entry)
4. Generate opening entry for next year (optional)
"""

from datetime import date
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from finances.services import FinanceService

from .models import (
    Account,
    AccountingSettings,
    AccountType,
    FiscalYear,
    FiscalYearAccountMapping,
    JournalEntry,
    JournalItem,
)
from .services import JournalEntryService


class FiscalYearClosingService:
    # ---------------------------------------------------------------
    # 1. PREVIEW — Pre-closing dry-run
    # ---------------------------------------------------------------
    @staticmethod
    def preview_closing(year: int) -> dict:
        """
        Returns a dry-run preview of what the fiscal year closing
        would produce, including validation results.

        Returns dict with:
        - income_accounts: list of {id, code, name, balance}
        - expense_accounts: list of {id, code, name, balance}
        - total_income, total_expenses, net_result
        - validations: dict with pre-closing checks
        """
        start_date = date(year, 1, 1)
        end_date = date(year, 12, 31)

        # Collect P&L account balances for the fiscal year
        income_accounts = FiscalYearClosingService._get_pl_account_balances(
            AccountType.INCOME, start_date, end_date
        )
        expense_accounts = FiscalYearClosingService._get_pl_account_balances(
            AccountType.EXPENSE, start_date, end_date
        )

        total_income = sum(a["balance"] for a in income_accounts)
        total_expenses = sum(a["balance"] for a in expense_accounts)
        net_result = total_income - total_expenses

        # Auto-create checklist instances for this year
        FiscalYearClosingService._auto_create_checklist_instances(year)

        # Run pre-closing validations
        validations = FiscalYearClosingService._run_preclosing_validations(year)

        # Get settings for result account
        settings = AccountingSettings.get_solo()
        result_account = settings.partner_current_year_earnings_account if settings else None

        return {
            "year": year,
            "income_accounts": income_accounts,
            "expense_accounts": expense_accounts,
            "income_total": float(total_income),
            "expense_total": float(total_expenses),
            "net_result": float(net_result),
            "is_profit": net_result > 0,
            "is_loss": net_result < 0,
            "validations": validations,
            "can_close": all(v["passed"] for v in validations.values()),
            "result_account_id": result_account.id if result_account else None,
            "result_account_code": result_account.code if result_account else None,
            "result_account_name": result_account.name if result_account else None,
            "is_balanced": FinanceService.get_trial_balance(start_date, end_date)["is_balanced"],
        }

    # ---------------------------------------------------------------
    # 2. CLOSE — Execute fiscal year closing
    # ---------------------------------------------------------------
    @staticmethod
    @transaction.atomic
    def close_fiscal_year(year: int, user, notes: str = "") -> FiscalYear:
        """
        Executes the annual closing process:
        1. Validates all preconditions
        2. Calculates total income and expenses for the year
        3. Generates the closing journal entry
        4. Updates FiscalYear status to CLOSED

        The closing entry:
        - Debits all income accounts (to zero them out)
        - Credits all expense accounts (to zero them out)
        - Credits/Debits the result account (3.4.01 Utilidad del Ejercicio)

        Returns:
            FiscalYear instance
        """
        # Get or create FiscalYear
        fiscal_year, _ = FiscalYear.objects.get_or_create(
            year=year,
            defaults={
                "start_date": date(year, 1, 1),
                "end_date": date(year, 12, 31),
            },
        )

        if fiscal_year.status == FiscalYear.Status.CLOSED:
            raise ValidationError(
                "Este ejercicio fiscal ya está cerrado. Debe reabrirlo antes de volver a cerrarlo."
            )

        # Run validations
        validations = FiscalYearClosingService._run_preclosing_validations(year)
        failed = [k for k, v in validations.items() if not v["passed"]]
        if failed:
            messages = [validations[k]["message"] for k in failed]
            raise ValidationError(
                "No se puede cerrar el ejercicio. Errores:\n"
                + "\n".join(f"• {m}" for m in messages)
            )

        # Get settings
        settings = AccountingSettings.get_solo()
        if not settings or not settings.partner_current_year_earnings_account:
            raise ValidationError(
                "Falta configurar la Cuenta de Utilidades del Ejercicio Actual "
                "en Configuración Contable (partner_current_year_earnings_account)."
            )

        result_account = settings.partner_current_year_earnings_account

        start_date = date(year, 1, 1)
        end_date = date(year, 12, 31)

        import calendar

        from tax.models import AccountingPeriod

        last_period = AccountingPeriod.objects.filter(year=year).order_by("-month").first()
        entry_month = last_period.month if last_period else 12
        entry_day = calendar.monthrange(year, entry_month)[1]
        entry_date = date(year, entry_month, entry_day)

        # Collect P&L balances
        income_accounts = FiscalYearClosingService._get_pl_account_balances(
            AccountType.INCOME, start_date, end_date
        )
        expense_accounts = FiscalYearClosingService._get_pl_account_balances(
            AccountType.EXPENSE, start_date, end_date
        )

        total_income = sum(Decimal(str(a["balance"])) for a in income_accounts)
        total_expenses = sum(Decimal(str(a["balance"])) for a in expense_accounts)
        net_result = total_income - total_expenses

        # ------- Generate Closing Entry -------
        closing_entry = JournalEntry(
            date=entry_date,
            description=f"Cierre Anual del Ejercicio {year}",
            reference=f"CIERRE-{year}",
            status=JournalEntry.Status.DRAFT,
        )
        closing_entry._is_system_closing_entry = True
        closing_entry.is_manual = False
        closing_entry.save()

        items = []

        # 1. Close INCOME accounts (they have credit-normal balance → debit to close)
        for acc_data in income_accounts:
            if acc_data["balance"] == 0:
                continue
            balance = Decimal(str(acc_data["balance"]))
            items.append(
                JournalItem(
                    entry=closing_entry,
                    account_id=acc_data["id"],
                    label=f"Cierre {acc_data['code']} {acc_data['name']}",
                    debit=balance if balance > 0 else Decimal("0"),
                    credit=abs(balance) if balance < 0 else Decimal("0"),
                )
            )

        # 2. Close EXPENSE accounts (they have debit-normal balance → credit to close)
        for acc_data in expense_accounts:
            if acc_data["balance"] == 0:
                continue
            balance = Decimal(str(acc_data["balance"]))
            items.append(
                JournalItem(
                    entry=closing_entry,
                    account_id=acc_data["id"],
                    label=f"Cierre {acc_data['code']} {acc_data['name']}",
                    debit=Decimal("0") if balance > 0 else abs(balance),
                    credit=balance if balance > 0 else Decimal("0"),
                )
            )

        # 3. Result → Equity
        if net_result > 0:
            # Profit: Credit the result account (increase equity)
            items.append(
                JournalItem(
                    entry=closing_entry,
                    account=result_account,
                    label=f"Utilidad del Ejercicio {year}",
                    debit=Decimal("0"),
                    credit=net_result,
                )
            )
        elif net_result < 0:
            # Loss: Debit the result account (decrease equity)
            items.append(
                JournalItem(
                    entry=closing_entry,
                    account=result_account,
                    label=f"Pérdida del Ejercicio {year}",
                    debit=abs(net_result),
                    credit=Decimal("0"),
                )
            )
        # If net_result == 0, no equity line needed (income == expenses)

        if items:
            JournalItem.objects.bulk_create(items)
            JournalEntryService.post_entry(closing_entry)
        else:
            # No P&L movements to close — delete the empty draft and proceed without a closing entry
            closing_entry.delete()
            closing_entry = None

        # Snapshot account→report category mappings for historical reports
        leaf_accounts = Account.objects.filter(children__isnull=True)
        mapping_records = [
            FiscalYearAccountMapping(
                fiscal_year=fiscal_year,
                account=account,
                is_category=account.effective_is_category,
                bs_category=account.effective_bs_category,
                cf_category=account.effective_cf_category,
            )
            for account in leaf_accounts
        ]
        FiscalYearAccountMapping.objects.bulk_create(mapping_records, ignore_conflicts=True)

        # Update FiscalYear
        fiscal_year.status = FiscalYear.Status.CLOSED
        fiscal_year.closing_entry = closing_entry
        fiscal_year.net_result = net_result
        fiscal_year.closed_at = timezone.now()
        fiscal_year.closed_by = user
        fiscal_year.notes = notes
        fiscal_year.save()

        # Automáticamente generar el asiento de apertura para el siguiente ejercicio
        # que re-clasificará las utilidades del ejercicio cerrado a resultados acumulados.
        FiscalYearClosingService.generate_opening_entry(year, user)

        return fiscal_year

    # ---------------------------------------------------------------
    # 3. REOPEN — Reverse the closing
    # ---------------------------------------------------------------
    @staticmethod
    @transaction.atomic
    def reopen_fiscal_year(year: int, user) -> FiscalYear:
        """
        Reopens a closed fiscal year using an administrative protocol:
        1. Checks for downstream dependencies (e.g. executed profit distributions)
        2. Sets year and relevant periods to OPEN (cascading)
        3. Reverses the closing/opening entries
        """
        try:
            fiscal_year = FiscalYear.objects.get(year=year)
        except FiscalYear.DoesNotExist:
            raise ValidationError(f"No existe un ejercicio fiscal para el año {year}.")

        if fiscal_year.status != FiscalYear.Status.CLOSED:
            raise ValidationError("El ejercicio fiscal no está cerrado.")

        # --- 1. Audit Dependency Check ---
        # Check if there is an executed profit distribution resolution
        # We use a late import to avoid circular dependencies
        from contacts.partner_models import ProfitDistributionResolution

        try:
            distribution = fiscal_year.profit_distribution
            if distribution.status == ProfitDistributionResolution.Status.EXECUTED:
                raise ValidationError(
                    f"No se puede reabrir el ejercicio {year} porque ya tiene "
                    f"una Distribución de Utilidades EJECUTADA. Debe anular la "
                    f"distribución en el módulo de Socios primero."
                )
        except ProfitDistributionResolution.DoesNotExist:
            pass

        # --- 2. Cascading Unlock ---
        # We open the year first so validations in save() allow the reversal process
        fiscal_year.status = FiscalYear.Status.OPEN
        fiscal_year.save()

        # Unlock the specific accounting periods related to the entries (not necessarily Dec/Jan)
        from tax.models import AccountingPeriod

        if fiscal_year.closing_entry:
            AccountingPeriod.objects.filter(
                year=fiscal_year.closing_entry.date.year,
                month=fiscal_year.closing_entry.date.month,
                status=AccountingPeriod.Status.CLOSED,
            ).update(status=AccountingPeriod.Status.OPEN)

        if fiscal_year.opening_entry:
            AccountingPeriod.objects.filter(
                year=fiscal_year.opening_entry.date.year,
                month=fiscal_year.opening_entry.date.month,
                status=AccountingPeriod.Status.CLOSED,
            ).update(status=AccountingPeriod.Status.OPEN)

        # --- 3. Entry Reversals ---
        # Reverse opening entry (for year + 1)
        if fiscal_year.opening_entry:
            if fiscal_year.opening_entry.status == JournalEntry.Status.POSTED:
                JournalEntryService.reverse_entry(
                    fiscal_year.opening_entry,
                    description=f"Reverso Apertura {year + 1} (por reapertura Ej. {year})",
                )
            fiscal_year.opening_entry = None

        # Reverse closing entry (for current year)
        if fiscal_year.closing_entry:
            if fiscal_year.closing_entry.status == JournalEntry.Status.POSTED:
                JournalEntryService.reverse_entry(
                    fiscal_year.closing_entry, description=f"Reverso Cierre Ejercicio {year}"
                )
            fiscal_year.closing_entry = None

        # Remove historical mapping snapshot
        fiscal_year.account_mappings.all().delete()

        # Clean up metadata
        fiscal_year.net_result = None
        fiscal_year.closed_at = None
        fiscal_year.closed_by = None
        fiscal_year.save()

        return fiscal_year

    # ---------------------------------------------------------------
    # 4. GENERATE OPENING ENTRY — Optional
    # ---------------------------------------------------------------
    @staticmethod
    @transaction.atomic
    def generate_opening_entry(year: int, user) -> FiscalYear:
        """
        Generates an opening entry for the fiscal year AFTER the given year.
        This transfers all balance sheet account balances (Assets, Liabilities,
        Equity) as of Dec 31 of `year` into a single entry dated Jan 1 of year+1.

        This is optional — the system calculates balances in real time,
        but some accountants prefer explicit opening entries.

        Returns:
            FiscalYear instance (of the closed year)
        """
        try:
            fiscal_year = FiscalYear.objects.get(year=year)
        except FiscalYear.DoesNotExist:
            raise ValidationError(f"No existe un ejercicio fiscal para el año {year}.")

        if fiscal_year.status != FiscalYear.Status.CLOSED:
            raise ValidationError(
                "El ejercicio fiscal debe estar cerrado antes de generar "
                "un asiento de apertura para el siguiente año."
            )

        if fiscal_year.opening_entry:
            raise ValidationError(
                "Ya existe un asiento de apertura para este ejercicio. "
                "Reabra el ejercicio y ciérrelo nuevamente si necesita regenerarlo."
            )

        end_date = date(year, 12, 31)

        from tax.models import AccountingPeriod

        first_period = AccountingPeriod.objects.filter(year=year + 1).order_by("month").first()
        entry_month = first_period.month if first_period else 1
        opening_date = date(year + 1, entry_month, 1)

        # Get all balance sheet leaf accounts with non-zero balances
        balance_types = [AccountType.ASSET, AccountType.LIABILITY, AccountType.EQUITY]
        leaf_accounts = Account.objects.filter(
            account_type__in=balance_types,
            children__isnull=True,  # Only leaf accounts
        )

        opening_entry = JournalEntry(
            date=opening_date,
            description=f"Asiento de Apertura {year + 1}",
            reference=f"APERTURA-{year + 1}",
            status=JournalEntry.Status.DRAFT,
        )
        opening_entry._is_system_closing_entry = True
        opening_entry.is_manual = False
        opening_entry.save()

        settings = AccountingSettings.get_solo()
        current_earnings_acc = settings.partner_current_year_earnings_account
        retained_earnings_acc = settings.partner_retained_earnings_account

        items = []

        for account in leaf_accounts:
            # Calculate accumulated balance up to end_date
            result = JournalItem.objects.filter(
                account=account,
                entry__status=JournalEntry.Status.POSTED,
                entry__date__lte=end_date,
            ).aggregate(
                total_debit=Sum("debit"),
                total_credit=Sum("credit"),
            )

            total_debit = result["total_debit"] or Decimal("0")
            total_credit = result["total_credit"] or Decimal("0")

            if total_debit == 0 and total_credit == 0:
                continue

            target_account = retained_earnings_acc if account == current_earnings_acc and retained_earnings_acc else account
            
            label = f"Apertura {target_account.code} {target_account.name}"
            if account == current_earnings_acc and retained_earnings_acc:
                label = f"Traslado de Utilidad Ej. {year}"

            # For balance sheet accounts, the opening entry carries the
            # accumulated balance forward
            if account.account_type in [AccountType.ASSET]:
                # Assets: debit-normal → opening debit = balance
                net = total_debit - total_credit
                if net > 0:
                    items.append(
                        JournalItem(
                            entry=opening_entry,
                            account=target_account,
                            label=label,
                            debit=net,
                            credit=Decimal("0"),
                        )
                    )
                elif net < 0:
                    items.append(
                        JournalItem(
                            entry=opening_entry,
                            account=target_account,
                            label=label,
                            debit=Decimal("0"),
                            credit=abs(net),
                        )
                    )
            else:
                # Liabilities & Equity: credit-normal → opening credit = balance
                net = total_credit - total_debit
                if net > 0:
                    items.append(
                        JournalItem(
                            entry=opening_entry,
                            account=target_account,
                            label=label,
                            debit=Decimal("0"),
                            credit=net,
                        )
                    )
                elif net < 0:
                    items.append(
                        JournalItem(
                            entry=opening_entry,
                            account=target_account,
                            label=label,
                            debit=abs(net),
                            credit=Decimal("0"),
                        )
                    )

        if not items:
            opening_entry.delete()
            raise ValidationError(
                "No hay saldos de cuentas de balance para generar asiento de apertura."
            )

        JournalItem.objects.bulk_create(items)

        # Post the entry
        JournalEntryService.post_entry(opening_entry)

        # Link to fiscal year
        fiscal_year.opening_entry = opening_entry
        fiscal_year.save(update_fields=["opening_entry", "updated_at"])

        return fiscal_year

    # ---------------------------------------------------------------
    # PRIVATE HELPERS
    # ---------------------------------------------------------------
    @staticmethod
    def _get_pl_account_balances(account_type: str, start_date: date, end_date: date) -> list:
        """
        Returns list of leaf P&L accounts with their balances for a period.
        Only includes accounts with non-zero balances.

        Returns: [{id, code, name, balance}, ...]
        """
        leaf_accounts = Account.objects.filter(
            account_type=account_type,
            children__isnull=True,
        ).order_by("code")

        results = []
        for account in leaf_accounts:
            agg = JournalItem.objects.filter(
                account=account,
                entry__status__in=JournalEntry.balance_affecting_statuses(),
                entry__date__gte=start_date,
                entry__date__lte=end_date,
            ).aggregate(
                total_debit=Sum("debit"),
                total_credit=Sum("credit"),
            )

            debit = agg["total_debit"] or Decimal("0")
            credit = agg["total_credit"] or Decimal("0")

            # Calculate balance based on account nature
            if account_type == AccountType.INCOME:
                balance = credit - debit  # Income: credit-normal
            else:
                balance = debit - credit  # Expense: debit-normal

            if balance != 0:
                results.append(
                    {
                        "id": account.id,
                        "code": account.code,
                        "name": account.name,
                        "balance": float(balance),
                    }
                )

        return results

    @staticmethod
    @staticmethod
    def _auto_create_checklist_instances(year: int) -> None:
        """Create ClosingChecklistInstance for all active templates and this fiscal year.

        If no FiscalYear record exists for the given year, it is auto-created here
        (same pattern as close_fiscal_year) so that the checklist endpoint
        GET /fiscal-years/<year>/checklist/ can always find the record.
        """
        from accounting.models import (
            ClosingChecklistInstance,
            ClosingChecklistTemplate,
            FiscalYear,
        )

        fiscal_year, _ = FiscalYear.objects.get_or_create(
            year=year,
            defaults={
                "start_date": date(year, 1, 1),
                "end_date": date(year, 12, 31),
            },
        )

        active_templates = ClosingChecklistTemplate.objects.filter(is_active=True)
        for template in active_templates:
            ClosingChecklistInstance.objects.get_or_create(
                fiscal_year=fiscal_year, template=template
            )

    @staticmethod
    def _run_preclosing_validations(year: int) -> dict:
        """
        Runs all pre-closing validations and returns a dict of results.
        Each validation: {key: {passed: bool, message: str}}
        """
        from tax.models import AccountingPeriod, TaxPeriod

        start_date = date(year, 1, 1)
        end_date = date(year, 12, 31)
        validations = {}

        # 1. Check FiscalYear is not already closed
        try:
            fy = FiscalYear.objects.get(year=year)
            is_closed = fy.status == FiscalYear.Status.CLOSED
        except FiscalYear.DoesNotExist:
            is_closed = False

        validations["fiscal_year_open"] = {
            "passed": not is_closed,
            "message": "El ejercicio fiscal ya está cerrado."
            if is_closed
            else "Ejercicio fiscal disponible para cierre.",
        }

        # 2. Check all existing accounting periods are CLOSED
        total_periods = AccountingPeriod.objects.filter(year=year).count()
        closed_periods = AccountingPeriod.objects.filter(
            year=year, status=AccountingPeriod.Status.CLOSED
        ).count()

        all_closed = (closed_periods == total_periods) and total_periods > 0
        partial_year = total_periods < 12

        if total_periods == 0:
            _periods_passed = True
            _periods_warning = False
            _periods_msg = "No hay periodos contables registrados para este ejercicio."
        elif all_closed:
            _periods_passed = True
            _periods_warning = partial_year
            _periods_msg = (
                f"Todos los {closed_periods} periodos mensuales creados están cerrados."
                + (" (Advertencia: Ejercicio con menos de 12 meses)" if partial_year else "")
            )
        elif partial_year:
            # Partial year with some open periods: warning only (not a hard block)
            _periods_passed = True
            _periods_warning = True
            _periods_msg = (
                f"Solo {closed_periods} de {total_periods} periodos creados están cerrados. "
                "Se recomienda cerrar todos los periodos antes del cierre anual."
            )
        else:
            # Full 12-month year with unclosed periods: hard block
            _periods_passed = False
            _periods_warning = False
            _periods_msg = (
                f"Solo {closed_periods} de {total_periods} periodos están cerrados. "
                "Todos los periodos deben estar cerrados antes del cierre anual."
            )

        validations["periods_closed"] = {
            "passed": _periods_passed,
            "is_warning": _periods_warning,
            "message": _periods_msg,
        }


        # 3. Check no DRAFT journal entries in the year
        draft_count = JournalEntry.objects.filter(
            date__gte=start_date,
            date__lte=end_date,
            status=JournalEntry.Status.DRAFT,
        ).count()

        validations["no_drafts"] = {
            "passed": draft_count == 0,
            "message": (
                f"Hay {draft_count} asientos en borrador en el año {year}. "
                "Todos deben estar publicados o anulados."
            )
            if draft_count > 0
            else "No hay asientos en borrador.",
        }

        # 4. Check result account is configured
        settings = AccountingSettings.get_solo()
        has_result_account = settings and settings.partner_current_year_earnings_account is not None

        validations["result_account"] = {
            "passed": has_result_account,
            "message": (
                "Falta configurar la Cuenta de Utilidades del Ejercicio Actual "
                "en Configuración Contable."
            )
            if not has_result_account
            else "Cuenta de resultado configurada.",
        }

        # 5. Check all TaxPeriods for the year are CLOSED (warning only — not a hard block)
        tax_total = TaxPeriod.objects.filter(year=year).count()
        tax_closed = TaxPeriod.objects.filter(
            year=year, status=TaxPeriod.Status.CLOSED
        ).count()
        tax_all_closed = tax_total == 0 or (tax_closed == tax_total)

        if tax_total == 0:
            _tax_msg = "No hay periodos tributarios (F29) registrados para este año."
            _tax_warning = True
        elif tax_all_closed:
            _tax_msg = f"Todos los {tax_closed} periodos tributarios del año están cerrados."
            _tax_warning = False
        else:
            _tax_msg = (
                f"Solo {tax_closed} de {tax_total} periodos tributarios (F29) "
                "están cerrados. Se recomienda cerrarlos antes del cierre anual."
            )
            _tax_warning = True

        validations["tax_periods_closed"] = {
            "passed": True,
            "is_warning": _tax_warning,
            "message": _tax_msg,
        }

        return validations

    @staticmethod
    def validate_can_close(user, year):
        if not user.has_perm('accounting.can_close_fiscal_year'):
            raise ValidationError("Sin permisos para cerrar ejercicio fiscal.")

    @staticmethod
    def validate_can_reopen(user, year):
        if not user.has_perm("accounting.can_reopen_fiscal_year"):
            raise ValidationError("No tiene permisos para reabrir el ejercicio fiscal.")
