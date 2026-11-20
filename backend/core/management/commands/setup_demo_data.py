# docker compose exec backend python manage.py setup_demo_data --purge
# SYNC_TRIGGER_20260207_0251

import random
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounting.models import (
    Account,
    AccountingSettings,
    AccountType,
    BSCategory,
    Budget,
    BudgetItem,
    JournalEntry,
    JournalItem,
)
from accounting.services import AccountingService
from contacts.models import Contact
from contacts.partner_models import (
    PartnerEquityStake,
    PartnerTransaction,
)
from core.models import (
    CompanySettings,
    User,
)
from hr.models import (
    AFP,
    Employee,
    EmployeeConceptAmount,
    GlobalHRSettings,
    Payroll,
    PayrollConcept,
)
from inventory.models import (
    InventoryDocument,
    InventoryDocumentDetail,
    Location,
    Product,
    ProductAttribute,
    ProductAttributeValue,
    ProductCategory,
    Subscription,
    UoM,
    UoMCategory,
    Warehouse,
)
from inventory.services import InventoryService
from production.models import (
    BillOfMaterials,
    BillOfMaterialsLine,
)
from tax.models import AccountingPeriod, TaxPeriod
from treasury.models import (
    Bank,
    BankLoan,
    CreditLine,
    PaymentMethod,
    PaymentTerminalDevice,
    PaymentTerminalProvider,
    POSTerminal,
    ReconciliationSettings,
    TreasuryAccount,
    TreasuryMovement,
)


def compute_rut_dv(rut_body: str) -> str:
    """
    Compute the verification digit (DV) for a Chilean RUT.
    Returns '0'-'9' or 'K'.
    """
    clean = rut_body.replace(".", "").replace("-", "").strip()
    if not clean.isdigit():
        raise ValueError(f"RUT body must be numeric, got: {rut_body}")
    total = 0
    multiplier = 2
    for digit in reversed(clean):
        total += int(digit) * multiplier
        multiplier = 2 if multiplier == 7 else multiplier + 1
    remainder = total % 11
    dv = 11 - remainder
    if dv == 11:
        return "0"
    elif dv == 10:
        return "K"
    return str(dv)


class Command(BaseCommand):
    help = "Seeds database with comprehensive graphic industry data using IFRS CoA"

    def add_arguments(self, parser):
        parser.add_argument(
            "--purge",
            action="store_true",
            help="Delete all existing business data before seeding",
        )
        parser.add_argument(
            "--no-demo-flows",
            action="store_true",
            help="Skip demo loans and the closing of past periods",
        )
        parser.add_argument(
            "--only-infra",
            action="store_true",
            help="Skip demo loans and period closing (forces --no-demo-flows)",
        )

    def handle(self, *args, **options):
        import time

        seed_start = time.time()

        # NOTE: No @transaction.atomic on the outer handle().
        # The purge phase runs each model deletion in its own savepoint via _safe_delete().
        # Wrapping the whole handle in one transaction would cause PostgreSQL to mark the
        # entire connection as aborted if any single savepoint fails, breaking all subsequent
        # deletions with "current transaction is aborted".
        if options["purge"]:
            self._purge_data()

        # Wrap the seeding phase in its own atomic block so we get full rollback
        # if anything fails during data creation (separate from the purge phase above).
        with transaction.atomic():
            section_start = time.time()
            self.stdout.write(f"\n{'─' * 50}")
            self.stdout.write("  Populating IFRS Chart of Accounts...")
            result_msg = AccountingService.populate_ifrs_coa()
            n_accounts = Account.objects.count()
            self.stdout.write(
                f"  ✓ {result_msg} ({n_accounts} cuentas, {time.time() - section_start:.1f}s)"
            )

            section_start = time.time()
            self.stdout.write(f"\n{'─' * 50}")
            self.stdout.write("  Configuring Inventory Accounting Mappings...")
            self._configure_inventory_accounting()
            self.stdout.write(f"  ({time.time() - section_start:.1f}s)")

            section_start = time.time()
            self.stdout.write(f"\n{'─' * 50}")
            self.stdout.write("  Creating Demo Users and Partners...")
            self._create_all_users()
            accounts = self._get_account_references()
            partners = self._create_partners(accounts)
            n_users = User.objects.count()
            n_contacts = Contact.objects.count()
            self.stdout.write(
                f"  ✓ {n_users} usuarios, {n_contacts} contactos ({time.time() - section_start:.1f}s)"
            )

            section_start = time.time()
            self.stdout.write(f"\n{'─' * 50}")
            self.stdout.write("  Units of Measure...")
            uoms = self._create_uoms()
            n_uom = UoM.objects.count()
            self.stdout.write(f"  ✓ {n_uom} UoMs ({time.time() - section_start:.1f}s)")

            section_start = time.time()
            self.stdout.write(f"\n{'─' * 50}")
            self.stdout.write("  Inventory & Manufacturing Data...")
            self._create_inventory(accounts, uoms)
            n_prods = Product.objects.count()
            n_boms = BillOfMaterials.objects.count()
            self.stdout.write(
                f"  ✓ {n_prods} productos, {n_boms} BOMs ({time.time() - section_start:.1f}s)"
            )

            section_start = time.time()
            self.stdout.write(f"\n{'─' * 50}")
            self.stdout.write("  Subscriptions...")
            self._create_subscriptions(accounts, partners["suppliers"])
            n_subs = Subscription.objects.count()
            self.stdout.write(f"  ✓ {n_subs} suscripciones ({time.time() - section_start:.1f}s)")

            section_start = time.time()
            self.stdout.write(f"\n{'─' * 50}")
            self.stdout.write("  Initial Stock...")
            total_stock_value = self._add_initial_stock(accounts, partners)
            self.stdout.write(f"  ({time.time() - section_start:.1f}s)")

            section_start = time.time()
            self.stdout.write(f"\n{'─' * 50}")
            self.stdout.write("  Opening Balance...")
            self._create_opening_balance(accounts, partners, total_stock_value)
            self.stdout.write(f"  ({time.time() - section_start:.1f}s)")

            section_start = time.time()
            self.stdout.write(f"\n{'─' * 50}")
            self.stdout.write("  Treasury Infrastructure...")
            self._create_treasury_infrastructure(accounts, partners)
            n_ta = TreasuryAccount.objects.count()
            n_banks = Bank.objects.count()
            n_pm = PaymentMethod.objects.count()
            self.stdout.write(
                f"  ✓ {n_ta} cuentas tesorería, {n_banks} bancos, {n_pm} métodos pago ({time.time() - section_start:.1f}s)"
            )

            section_start = time.time()
            self.stdout.write(f"\n{'─' * 50}")
            self.stdout.write("  Credit Lines (Overdraft)...")
            self._create_credit_lines()
            n_cl = CreditLine.objects.count()
            self.stdout.write(f"  ✓ {n_cl} líneas de crédito ({time.time() - section_start:.1f}s)")

            section_start = time.time()
            self.stdout.write(f"\n{'─' * 50}")
            self.stdout.write("  Accounting & Tax Periods...")
            self._create_periods()
            n_tax = TaxPeriod.objects.count()
            n_acc = AccountingPeriod.objects.count()
            self.stdout.write(
                f"  ✓ {n_tax} períodos tributarios, {n_acc} contables ({time.time() - section_start:.1f}s)"
            )

            if not options["no_demo_flows"] and not options["only_infra"]:
                section_start = time.time()
                self.stdout.write(f"\n{'─' * 50}")
                self.stdout.write("  Loans Demo...")
                self._create_loans_demo(accounts, partners)
                n_tm = TreasuryMovement.objects.count()
                self.stdout.write(
                    f"  ✓ {n_tm} movs. tesorería ({time.time() - section_start:.1f}s)"
                )
            section_start = time.time()
            self.stdout.write(f"\n{'─' * 50}")
            self.stdout.write("  Company Settings...")
            self._initialize_company_settings()
            self.stdout.write(f"  ({time.time() - section_start:.1f}s)")

            section_start = time.time()
            self.stdout.write(f"\n{'─' * 50}")
            self.stdout.write("  HR Data...")
            self._create_hr_demo_data(accounts)
            self.stdout.write(f"  ({time.time() - section_start:.1f}s)")

            section_start = time.time()
            self.stdout.write(f"\n{'─' * 50}")
            self.stdout.write("  Workflow Settings...")
            self._initialize_workflow_settings()
            self.stdout.write(f"  ({time.time() - section_start:.1f}s)")

            section_start = time.time()
            self.stdout.write(f"\n{'─' * 50}")
            self.stdout.write("  Demo Budget...")
            self._create_demo_budget(accounts)
            self.stdout.write(f"  ({time.time() - section_start:.1f}s)")

            if not options["no_demo_flows"] and not options["only_infra"]:
                section_start = time.time()
                self.stdout.write(f"\n{'─' * 50}")
                self.stdout.write("  Closing Past Periods (F29 + Accounting)...")
                self._close_past_periods(accounts)
                self.stdout.write(f"  ({time.time() - section_start:.1f}s)")

            section_start = time.time()
            self.stdout.write(f"\n{'─' * 50}")
            self.stdout.write("  Syncing Permissions...")
            from django.core.management import call_command
            call_command("sync_permissions", verbosity=0)
            self.stdout.write(f"  ({time.time() - section_start:.1f}s)")

        elapsed = time.time() - seed_start
        self.stdout.write(f"\n{'═' * 50}")
        self.stdout.write(
            self.style.SUCCESS(
                f"  Seed completado en {elapsed:.1f}s "
                f"({n_accounts} cuentas, {n_users} usuarios, "
                f"{n_prods} productos, {n_contacts} contactos)"
            )
        )

    def _configure_inventory_accounting(self):
        """
        The populate_ifrs_coa() service already configures ALL accounts comprehensively.
        This method just adds any additional demo-specific accounts or adjustments.
        """
        settings = AccountingSettings.get_solo()
        if not settings:
            self.stdout.write(
                self.style.WARNING(
                    "  ⚠ No AccountingSettings found. Skipping additional configuration."
                )
            )
            return

        # The populate_ifrs_coa service already configured:
        # - All 60+ default accounts (receivable, payable, revenue, expense, inventory, COGS, etc.)
        # - All 11 POS control accounts (cash difference, theft, tips, errors, etc.)
        # - All 2 terminal bridge accounts (commission, IVA)
        # - All 6 treasury reconciliation accounts (bank commission, interest, exchange, rounding, error, misc)
        # - All tax accounts (VAT, withholding, PPM, second category, correction)

        self.stdout.write("  ✓ All account mappings configured by populate_ifrs_coa service")
        self.stdout.write(f"  ✓ Total configured accounts: {Account.objects.count()}")

        # Display key mappings for verification
        key_mappings = {
            "Receivable": settings.default_receivable_account,
            "Payable": settings.default_payable_account,
            "Revenue": settings.default_revenue_account,
            "Expense": settings.default_expense_account,
            "Inventory (Storable)": settings.storable_inventory_account,
            "Inventory (Manufacturable)": settings.manufacturable_inventory_account,
            "COGS (Merchandise)": settings.merchandise_cogs_account,
            "COGS (Manufactured)": settings.manufactured_cogs_account,
            "POS Cash Difference (Gain)": settings.pos_cash_difference_gain_account,
            "POS Cash Difference (Loss)": settings.pos_cash_difference_loss_account,
            "Terminal Commission Bridge": settings.terminal_commission_bridge_account,
            "Terminal Commission IVA Bridge": settings.terminal_iva_bridge_account,
            "Bank Commission": settings.bank_commission_account,
            "VAT Payable": settings.vat_payable_account,
            "Loan Retention": settings.loan_retention_account,
            "ILA Tax": settings.ila_tax_account,
            "VAT Withholding (CS)": settings.vat_withholding_account,
            # Inventory Adjustment Verification
            "Inv. Gain": settings.adjustment_income_account,
            "Inv. Loss": settings.adjustment_expense_account,
            "Revaluation": settings.revaluation_account,
            # Treasury Reconciliation Verification
            "Interest Income": settings.interest_income_account,
            "Exchange Diff": settings.exchange_difference_account,
            "Rounding Adj": settings.rounding_adjustment_account,
            "Error Adj": settings.error_adjustment_account,
            "Misc Adj": settings.miscellaneous_adjustment_account,
            # Check Portfolio / Issued Checks (ADR-0038)
            "Check Portfolio (Asset)": settings.check_portfolio_account,
            "Issued Checks (Liability)": settings.issued_checks_account,
            # HR / Payroll
            "Remuneraciones por Pagar": settings.account_remuneraciones_por_pagar,
            "Previred por Pagar": settings.account_previred_por_pagar,
            "Anticipos Remuneraciones": settings.account_anticipos,
        }

        self.stdout.write("\n  📊 Key Account Mappings:")
        for name, account in key_mappings.items():
            if account:
                self.stdout.write(f"     • {name}: {account.code} - {account.name}")
            else:
                self.stdout.write(self.style.WARNING(f"     ⚠ {name}: NOT CONFIGURED"))

        # Sync Location.account for VIRTUAL locations from AccountingSettings
        virtual_account_map = {
            "Ajuste por Sobrante/Ganancia": settings.adjustment_income_account,
            "Ajuste por Merma/Pérdida": settings.adjustment_expense_account,
            "Capital de Socios": settings.partner_capital_contribution_account,
        }
        synced = 0
        for loc_name, account in virtual_account_map.items():
            if account:
                updated = Location.objects.filter(
                    location_type="VIRTUAL", name=loc_name
                ).update(account=account)
                synced += updated
        if synced:
            self.stdout.write(f"  ✓ Synced {synced} virtual location accounts from AccountingSettings")

        # ADR-0038: Verifica que las TreasuryAccount puente de Cheque fueron
        # auto-creadas por el signal post_save de AccountingSettings al
        # cablear check_portfolio_account / issued_checks_account. Si el
        # operador reconfigura las cuentas vía UI, el signal las recrea
        # de forma idempotente.
        self.stdout.write("\n  💳 Check Bridge TreasuryAccounts (ADR-0038):")
        for ta in TreasuryAccount.objects.filter(
            account_type__in=[
                TreasuryAccount.Type.CHECK_PORTFOLIO,
                TreasuryAccount.Type.ISSUED_CHECKS,
            ]
        ).order_by("account_type"):
            gl = f"{ta.account.code} - {ta.account.name}" if ta.account_id else "—"
            self.stdout.write(f"     • {ta.code} ({ta.get_account_type_display()}): GL {gl}")

    # Tablas que la purga NUNCA vacía: metadatos que Django regenera en post_migrate
    # (content types y permisos). `django_migrations` no es un modelo, así que no entra.
    PURGE_KEEP_MODELS = frozenset({"contenttypes.contenttype", "auth.permission"})

    def _purge_data(self):
        """Vacía TODAS las tablas de la BD, sin listas hardcodeadas.

        Descubre las tablas desde el registro de modelos de Django (incluye tablas M2M
        automáticas y modelos `Historical*` de simple_history), de modo que un modelo
        nuevo queda cubierto sin tocar este comando. Un único TRUNCATE ... CASCADE
        resuelve el orden de FKs y es atómico: o se vacía todo o no se toca nada.
        """
        import time

        from django.apps import apps
        from django.db import connection

        purge_start = time.time()
        existing_tables = set(connection.introspection.table_names())

        tables: dict[str, str] = {}
        for model in apps.get_models(include_auto_created=True):
            meta = model._meta
            if meta.proxy or not meta.managed or meta.swapped:
                continue
            if meta.label_lower in self.PURGE_KEEP_MODELS:
                continue
            if meta.db_table in existing_tables:
                tables[meta.db_table] = meta.label

        qn = connection.ops.quote_name
        counts: dict[str, int] = {}
        with connection.cursor() as cursor:
            for table in sorted(tables):
                cursor.execute(f"SELECT COUNT(*) FROM {qn(table)}")
                counts[table] = cursor.fetchone()[0]

        self.stdout.write(f"\n  {'─' * 3} Purge total ({len(tables)} tablas) {'─' * 20}")
        for table, n in sorted(counts.items(), key=lambda kv: -kv[1]):
            if n:
                self.stdout.write(f"  {tables[table]:<45} {n:>6} registros")

        with transaction.atomic(), connection.cursor() as cursor:
            cursor.execute(
                "TRUNCATE TABLE "
                + ", ".join(qn(t) for t in sorted(tables))
                + " RESTART IDENTITY CASCADE"
            )

        # Verificación: ninguna tabla purgable puede quedar con filas.
        leftovers = []
        with connection.cursor() as cursor:
            for table in sorted(tables):
                cursor.execute(f"SELECT COUNT(*) FROM {qn(table)}")
                if cursor.fetchone()[0]:
                    leftovers.append(tables[table])
        if leftovers:
            raise CommandError(f"La purga dejó registros en: {', '.join(leftovers)}")

        self.stdout.write(f"\n  {'─' * 50}")
        self.stdout.write(
            self.style.SUCCESS(
                f"  Purge completado: {sum(counts.values()):,} registros "
                f"en {time.time() - purge_start:.1f}s"
            )
        )

    def _get_account_references(self):
        # We fetch accounts by code as defined in the modernize IFRS service
        return {
            "cash": Account.objects.get(code="1.1.01.01"),
            "bank": Account.objects.get(code="1.1.01.02"),
            "receivable": Account.objects.get(code="1.1.02.01"),
            "payable": Account.objects.get(code="2.1.01.01"),
            "inventory_raw": Account.objects.get(code="1.1.03.02"),
            "inventory_finished": Account.objects.get(code="1.1.03.01"),
            "vat_credit": Account.objects.get(code="1.1.04.01"),
            "vat_debit": Account.objects.get(code="2.1.02.01"),
            "capital": Account.objects.get(code="3.1.01"),
            "partner_receivable": Account.objects.get(code="1.1.05.01"),
            "sales_product": Account.objects.get(code="4.1.01"),
            "sales_service": Account.objects.get(code="4.1.02"),
            "cogs_product": Account.objects.get(code="5.1.01"),
            "cogs_manufactured": Account.objects.get(code="5.1.02"),  # NEW
            "cogs_service": Account.objects.get(code="5.1.03"),  # Updated from 5.1.02
            "expense_general": Account.objects.get(code="5.2.06"),
            "expense_utilities": Account.objects.get(code="5.2.03"),
            "expense_rent": Account.objects.get(code="5.2.02"),
            "vat_carryforward": Account.objects.get(code="1.1.04.02"),
            "vat_payable": Account.objects.get(code="2.1.02.02"),
            "loan_retention": Account.objects.get(code="2.1.02.05"),
            "ila_tax": Account.objects.get(code="2.1.02.06"),
            "vat_withholding": Account.objects.get(code="2.1.02.07"),
            "correction_income": Account.objects.get(code="4.2.07"),
            "salary_payable": Account.objects.get(code="2.1.03.01"),
            "previred_payable": Account.objects.get(code="2.1.03.02"),
            "salary_advance": Account.objects.get(code="1.1.02.03"),
            "expense_salary": Account.objects.get(code="5.2.01.01"),
            "expense_prevision": Account.objects.get(code="5.2.01.02"),
            "bank_commission": Account.objects.get(code="5.2.10"),
            # F5.1 — Financial expense accounts (ADR-0036)
            "interest_expense": Account.objects.get(code="5.3.01"),
            "insurance_expense": Account.objects.get(code="5.2.09"),
            "interest_payable": Account.objects.get(code="2.1.04.01"),
            "credit_card_payable": Account.objects.get(code="2.1.04.02"),
            # Nuevas cuentas Fase 1
            "inventory_fabricables": Account.objects.get(code="1.1.03.03"),
            "subscription_income": Account.objects.get(code="4.1.03"),
            "revaluation": Account.objects.get(code="4.2.08"),
            "pos_other_inflow": Account.objects.get(code="4.2.09"),
            "subscription_expense": Account.objects.get(code="5.1.04"),
            "loan_penalty": Account.objects.get(code="5.2.20"),
            "loan_commission": Account.objects.get(code="5.2.21"),
            "loan_stamp_tax": Account.objects.get(code="5.2.22"),
            "pos_other_outflow": Account.objects.get(code="5.2.23"),
            "pos_cashback_error": Account.objects.get(code="5.2.24"),
            "pos_system_error": Account.objects.get(code="5.2.25"),
            "uncollectible_expense": Account.objects.get(code="5.2.26"),
            "tax_withholding": Account.objects.get(code="2.1.02.08"),
        }

    def _create_partners(self, accounts):
        # 1. Default customer
        c_default, _ = Contact.objects.get_or_create(
            tax_id="66000000-3",
            defaults={
                "name": "Cliente Ocasional",
                "email": "contacto@clienteocasional.cl",
                "is_default_customer": True,
            },
        )
        if not c_default.is_default_customer:
            c_default.is_default_customer = True
            c_default.save()

        # 2. Company Owners (Partners for the Hybrid Model)
        # We create them first to ensure they have their individual accounts mapped
        def get_or_create_subaccount(parent_code, partner_name, suffix):
            parent = Account.objects.get(code=parent_code)
            code = f"{parent_code}.{suffix}"
            name = f"{parent.name} - {partner_name}"
            acc, _ = Account.objects.get_or_create(
                code=code,
                defaults={
                    "name": name,
                    "account_type": parent.account_type,
                    "parent": parent,
                    "is_reconcilable": True,
                    "bs_category": parent.bs_category,  # Inherit BS category for reports
                    "is_category": parent.is_category,
                    "cf_category": parent.cf_category,
                },
            )
            return acc

        # Socio A: Administrador
        socio_a_capital = get_or_create_subaccount("3.1.01", "Socio A", "001")
        get_or_create_subaccount("3.2.01", "Socio A", "001")
        socio_a_receivable = get_or_create_subaccount("1.1.05.01", "Socio A", "001")
        get_or_create_subaccount("2.1.07", "Socio A", "001")

        socio_a, _ = Contact.objects.get_or_create(
            tax_id="11222333-9",
            defaults={
                "name": "Socio Administrador (Socio A)",
                "email": "socio.a@empresa.cl",
                "is_partner": True,
                "partner_equity_percentage": Decimal("35.00"),
            },
        )
        if socio_a.partner_equity_percentage != Decimal("35.00"):
            socio_a.partner_equity_percentage = Decimal("35.00")
            socio_a.save(update_fields=["partner_equity_percentage"])
        if not PartnerEquityStake.objects.filter(partner=socio_a).exists():
            PartnerEquityStake.objects.create(
                partner=socio_a, percentage=Decimal("35.00"), effective_from=timezone.localdate()
            )

        # Socio B: Capitalista
        socio_b_capital = get_or_create_subaccount("3.1.01", "Socio B", "002")
        get_or_create_subaccount("3.2.01", "Socio B", "002")
        socio_b_receivable = get_or_create_subaccount("1.1.05.01", "Socio B", "002")
        get_or_create_subaccount("2.1.07", "Socio B", "002")

        socio_b, _ = Contact.objects.get_or_create(
            tax_id="22333444-K",
            defaults={
                "name": "Socio Capitalista (Socio B)",
                "email": "socio.b@empresa.cl",
                "is_partner": True,
                "partner_equity_percentage": Decimal("35.00"),
            },
        )
        if socio_b.partner_equity_percentage != Decimal("35.00"):
            socio_b.partner_equity_percentage = Decimal("35.00")
            socio_b.save(update_fields=["partner_equity_percentage"])
        if not PartnerEquityStake.objects.filter(partner=socio_b).exists():
            PartnerEquityStake.objects.create(
                partner=socio_b, percentage=Decimal("35.00"), effective_from=timezone.localdate()
            )

        # Socio C: Admin/Owner (linked to the admin system user)
        socio_admin_capital = get_or_create_subaccount("3.1.01", "Socio Admin", "003")
        get_or_create_subaccount("3.2.01", "Socio Admin", "003")
        socio_admin_receivable = get_or_create_subaccount("1.1.05.01", "Socio Admin", "003")
        get_or_create_subaccount("2.1.07", "Socio Admin", "003")

        admin_contact = Contact.objects.filter(tax_id="11111111-1").first()
        if admin_contact:
            if not admin_contact.is_partner:
                admin_contact.is_partner = True
                admin_contact.partner_equity_percentage = Decimal("30.00")
                admin_contact.partner_since = timezone.localdate()
                admin_contact.save(update_fields=["is_partner", "partner_equity_percentage", "partner_since"])
            elif admin_contact.partner_equity_percentage != Decimal("30.00"):
                admin_contact.partner_equity_percentage = Decimal("30.00")
                admin_contact.save(update_fields=["partner_equity_percentage"])
            if not PartnerEquityStake.objects.filter(partner=admin_contact).exists():
                PartnerEquityStake.objects.create(
                    partner=admin_contact, percentage=Decimal("30.00"),
                    effective_from=timezone.localdate(),
                    notes="Socio fundador — usuario admin del sistema",
                )

        owner_accounts = {
            socio_a.id: {"capital": socio_a_capital, "receivable": socio_a_receivable},
            socio_b.id: {"capital": socio_b_capital, "receivable": socio_b_receivable},
        }
        owners_list = [socio_a, socio_b]
        if admin_contact:
            owner_accounts[admin_contact.id] = {
                "capital": socio_admin_capital,
                "receivable": socio_admin_receivable,
            }
            owners_list.append(admin_contact)

        # 3. Regular Customers and Suppliers
        c1, _ = Contact.objects.get_or_create(
            tax_id="76111222-8",
            defaults={"name": "Editorial Amanecer S.A.", "email": "contacto@amanecer.cl"},
        )
        c2, _ = Contact.objects.get_or_create(
            tax_id="77333444-7",
            defaults={"name": "Publicidad Creativa Ltda", "email": "ventas@pubcreativa.cl"},
        )

        s1, _ = Contact.objects.get_or_create(
            tax_id="88222333-7",
            defaults={"name": "Distribuidora de Papeles S.A.", "email": "pedidos@papelessa.cl"},
        )
        s2, _ = Contact.objects.get_or_create(
            tax_id="99555666-9",
            defaults={"name": "Tintas Gráficas SpA", "email": "tintas@graficas.cl"},
        )
        s3, _ = Contact.objects.get_or_create(
            tax_id="76444555-4",
            defaults={"name": "Servicios Eléctricos Enel", "email": "factura@enel.cl"},
        )

        return {
            "default_customer": c_default,
            "owners": owners_list,
            "owner_accounts": owner_accounts,
            "customers": [c1, c2],
            "suppliers": [s1, s2, s3],
        }

    def _create_uoms(self):
        cat_units, _ = UoMCategory.objects.get_or_create(name="Unidades")
        cat_weight, _ = UoMCategory.objects.get_or_create(name="Peso")
        cat_graphic, _ = UoMCategory.objects.get_or_create(name="Medidas Gráficas")

        # Basic
        uom_un, created = UoM.objects.get_or_create(
            name="Unidad",
            defaults={"category": cat_units, "ratio": 1.0, "uom_type": UoM.Type.REFERENCE,
                       "name_singular": "Unidad", "name_plural": "Unidades", "abbreviation": "un"},
        )
        if not created:
            UoM.objects.filter(pk=uom_un.pk).update(
                name_singular="Unidad", name_plural="Unidades", abbreviation="un")

        uom_kg, created = UoM.objects.get_or_create(
            name="Kilogramo (kg)",
            defaults={"category": cat_weight, "ratio": 1.0, "uom_type": UoM.Type.REFERENCE,
                       "name_singular": "Kilogramo", "name_plural": "Kilogramos", "abbreviation": "kg"},
        )
        if not created:
            UoM.objects.filter(pk=uom_kg.pk).update(
                name_singular="Kilogramo", name_plural="Kilogramos", abbreviation="kg")

        # Graphic specifics
        uom_hoja, created = UoM.objects.get_or_create(
            name="Hoja",
            defaults={"category": cat_graphic, "ratio": 1.0, "uom_type": UoM.Type.REFERENCE,
                       "name_singular": "Hoja", "name_plural": "Hojas", "abbreviation": "hj"},
        )
        if not created:
            UoM.objects.filter(pk=uom_hoja.pk).update(
                name_singular="Hoja", name_plural="Hojas", abbreviation="hj")

        uom_millar, created = UoM.objects.get_or_create(
            name="Millar (1000u)",
            defaults={"category": cat_units, "ratio": 1000.0, "uom_type": UoM.Type.BIGGER,
                       "name_singular": "Millar", "name_plural": "Miles", "abbreviation": "ml"},
        )
        if not created:
            UoM.objects.filter(pk=uom_millar.pk).update(
                name_singular="Millar", name_plural="Miles", abbreviation="ml")

        uom_resma, created = UoM.objects.get_or_create(
            name="Resma (500 pl)",
            defaults={"category": cat_graphic, "ratio": 500.0, "uom_type": UoM.Type.BIGGER,
                       "name_singular": "Resma", "name_plural": "Resmas", "abbreviation": "rsm"},
        )
        if not created:
            UoM.objects.filter(pk=uom_resma.pk).update(
                name_singular="Resma", name_plural="Resmas", abbreviation="rsm")

        uom_paquete, created = UoM.objects.get_or_create(
            name="Paquete (100u)",
            defaults={"category": cat_units, "ratio": 100.0, "uom_type": UoM.Type.BIGGER,
                       "name_singular": "Paquete", "name_plural": "Paquetes", "abbreviation": "paq"},
        )
        if not created:
            UoM.objects.filter(pk=uom_paquete.pk).update(
                name_singular="Paquete", name_plural="Paquetes", abbreviation="paq")

        return {
            "un": uom_un,
            "kg": uom_kg,
            "hoja": uom_hoja,
            "millar": uom_millar,
            "resma": uom_resma,
            "paquete": uom_paquete,
        }

    def _create_attributes(self):
        color, _ = ProductAttribute.objects.get_or_create(name="Color")
        material, _ = ProductAttribute.objects.get_or_create(name="Material")
        talla, _ = ProductAttribute.objects.get_or_create(name="Talla")

        for val in ["Blanco", "Negro", "Rojo", "Azul"]:
            ProductAttributeValue.objects.get_or_create(attribute=color, value=val)

        for val in ["Papel Couché 300g", "Papel Kraft", "PVC"]:
            ProductAttributeValue.objects.get_or_create(attribute=material, value=val)

        for val in ["S", "M", "L", "XL"]:
            ProductAttributeValue.objects.get_or_create(attribute=talla, value=val)

        return {"color": color, "material": material, "talla": talla}

    def _create_inventory(self, accounts, uoms):
        wh, _ = Warehouse.objects.get_or_create(
            code="WH-CITY", defaults={"name": "Bodega Taller Central"}
        )

        cat_raw, _ = ProductCategory.objects.get_or_create(
            name="Materias Primas",
            defaults={
                "income_account": accounts["sales_product"],
                "expense_account": accounts["cogs_product"],
                "prefix": "MP",
            },
        )
        if cat_raw.asset_account:
            cat_raw.asset_account = None
            cat_raw.save()

        cat_supplies, _ = ProductCategory.objects.get_or_create(
            name="Insumos",
            defaults={
                "income_account": accounts["sales_product"],
                "expense_account": accounts["cogs_product"],
                "prefix": "INS",
            },
        )
        if cat_supplies.asset_account:
            cat_supplies.asset_account = None
            cat_supplies.save()

        cat_finished, _ = ProductCategory.objects.get_or_create(
            name="Productos Terminados",
            defaults={
                "income_account": accounts["sales_product"],
                "expense_account": accounts["cogs_manufactured"],
                "prefix": "PT",
            },
        )
        if cat_finished.asset_account:
            cat_finished.asset_account = None
            cat_finished.save()

        cat_services, _ = ProductCategory.objects.get_or_create(
            name="Servicios Gráficos",
            defaults={
                "income_account": accounts["sales_service"],
                "expense_account": accounts["cogs_service"],
                "prefix": "SRV",
            },
        )
        if cat_services.asset_account:
            cat_services.asset_account = None
            cat_services.save()

        # RAW MATERIALS - use skip_history=True during creation to avoid $0 history entry
        # The first meaningful history entry will come from _add_initial_stock when cost_price is set
        p_papel, _ = Product.objects.get_or_create(
            code="INS-0001",
            defaults={
                "name": "Resma de papel",
                "category": cat_supplies,
                "product_type": Product.Type.STORABLE,
                "uom": uoms["resma"],
                "purchase_uom": uoms["resma"],
                "sale_price": 5000,
                "receiving_warehouse": wh,
            },
        )
        if _:
            p_papel.skip_history_when_saving = True
            p_papel.save()
            del p_papel.skip_history_when_saving
        p_tinta_c, _ = Product.objects.get_or_create(
            code="MP-TIN-CYA",
            defaults={
                "name": "Tinta Offset Cyan 1kg",
                "category": cat_raw,
                "product_type": Product.Type.STORABLE,
                "uom": uoms["kg"],
                "purchase_uom": uoms["kg"],
                "sale_price": 12000,
                "receiving_warehouse": wh,
            },
        )
        p_tinta_m, _ = Product.objects.get_or_create(
            code="MP-TIN-MAG",
            defaults={
                "name": "Tinta Offset Magenta 1kg",
                "category": cat_raw,
                "product_type": Product.Type.STORABLE,
                "uom": uoms["kg"],
                "purchase_uom": uoms["kg"],
                "sale_price": 12000,
                "receiving_warehouse": wh,
            },
        )
        p_tinta_y, _ = Product.objects.get_or_create(
            code="MP-TIN-YEL",
            defaults={
                "name": "Tinta Offset Yellow 1kg",
                "category": cat_raw,
                "product_type": Product.Type.STORABLE,
                "uom": uoms["kg"],
                "purchase_uom": uoms["kg"],
                "sale_price": 12000,
                "receiving_warehouse": wh,
            },
        )
        p_tinta_k, _ = Product.objects.get_or_create(
            code="MP-TIN-BLA",
            defaults={
                "name": "Tinta Offset Black 1kg",
                "category": cat_raw,
                "product_type": Product.Type.STORABLE,
                "uom": uoms["kg"],
                "purchase_uom": uoms["kg"],
                "sale_price": 10000,
                "receiving_warehouse": wh,
            },
        )

        # FINISHED PRODUCTS (Fabricables)
        p_impresion_color, _ = Product.objects.get_or_create(
            code="PT-0001",
            defaults={
                "name": "Impresion a color",
                "category": cat_finished,
                "product_type": Product.Type.MANUFACTURABLE,
                "uom": uoms["hoja"],
                "sale_uom": uoms["hoja"],
                "sale_price": 150,
                "track_inventory": False,
                "mfg_enable_press": True,
                "mfg_enable_postpress": True,
                "mfg_auto_finalize": True,
            },
        )

        p_tarjetas, _ = Product.objects.get_or_create(
            code="PT-TAR-STAN",
            defaults={
                "name": "Tarjetas Personalizadas (Polimate)",
                "category": cat_finished,
                "product_type": Product.Type.MANUFACTURABLE,
                "uom": uoms["un"],
                "sale_uom": uoms["un"],
                "sale_price": 150,
                "is_dynamic_pricing": True,
                "track_inventory": True,
                "receiving_warehouse": wh,
                "requires_advanced_manufacturing": True,
            },
        )

        # ---------------------------------------------------------
        # PRODUCT VARIANTS DEMO
        # ---------------------------------------------------------
        attrs = self._create_attributes()
        p_polera_base, _ = Product.objects.get_or_create(
            code="PT-POL-BASE",
            defaults={
                "name": "Polera Corporativa",
                "category": cat_finished,
                "product_type": Product.Type.MANUFACTURABLE,
                "uom": uoms["un"],
                "sale_price": 8500,
                "has_variants": True,
                "mfg_auto_finalize": True,  # Express
                "requires_advanced_manufacturing": False,
            },
        )

        # Create some variants manually for the demo
        if p_polera_base:
            # Variant 1: Blanco - L
            v_blanco = ProductAttributeValue.objects.get(attribute=attrs["color"], value="Blanco")
            v_l = ProductAttributeValue.objects.get(attribute=attrs["talla"], value="L")

            p_blanco_l, _ = Product.objects.get_or_create(
                code="PT-POL-BLA-L",
                defaults={
                    "name": "Polera Corporativa",
                    "variant_display_name": "Polera Corporativa (Blanco, L)",
                    "category": cat_finished,
                    "product_type": Product.Type.MANUFACTURABLE,
                    "uom": uoms["un"],
                    "sale_price": 8500,
                    "parent_template": p_polera_base,
                    "mfg_auto_finalize": True,
                },
            )
            p_blanco_l.attribute_values.set([v_blanco, v_l])

            # Variant 2: Negro - XL
            v_negro = ProductAttributeValue.objects.get(attribute=attrs["color"], value="Negro")
            v_xl = ProductAttributeValue.objects.get(attribute=attrs["talla"], value="XL")

            p_negro_xl, _ = Product.objects.get_or_create(
                code="PT-POL-NEG-XL",
                defaults={
                    "name": "Polera Corporativa",
                    "variant_display_name": "Polera Corporativa (Negro, XL)",
                    "category": cat_finished,
                    "product_type": Product.Type.MANUFACTURABLE,
                    "uom": uoms["un"],
                    "sale_price": 9500,  # Price override
                    "parent_template": p_polera_base,
                    "mfg_auto_finalize": True,
                },
            )
            p_negro_xl.attribute_values.set([v_negro, v_xl])

        # BOMs
        if not BillOfMaterials.objects.filter(product=p_impresion_color).exists():
            bom_impresion_color = BillOfMaterials.objects.create(
                product=p_impresion_color, name="BOM Impresion a color", active=True
            )
            # Para 1 impresion a color.
            BillOfMaterialsLine.objects.create(
                bom=bom_impresion_color, component=p_papel, quantity=Decimal("1"), uom=uoms["hoja"]
            )

        # ---------------------------------------------------------
        # ADDITIONAL PRODUCTS LOOP (Increased Quantity)
        # ---------------------------------------------------------
        self.stdout.write("  Creating additional products...")
        extra_products = [
            ("Flyer Promocional A5", cat_finished, Product.Type.MANUFACTURABLE, 120, uoms["un"]),
            ("Tríptico Corporativo", cat_finished, Product.Type.MANUFACTURABLE, 350, uoms["un"]),
            (
                "Afiche Publicitario (Couché 170g)",
                cat_finished,
                Product.Type.MANUFACTURABLE,
                1500,
                uoms["un"],
            ),
            (
                "Etiqueta Adhesiva Premium",
                cat_finished,
                Product.Type.MANUFACTURABLE,
                80,
                uoms["un"],
            ),
            ("Carpeta Institucional", cat_finished, Product.Type.MANUFACTURABLE, 850, uoms["un"]),
            (
                "Libreta de Notas (Bond 80g)",
                cat_finished,
                Product.Type.MANUFACTURABLE,
                2500,
                uoms["un"],
            ),
            ("Sobre Americano Impreso", cat_finished, Product.Type.MANUFACTURABLE, 55, uoms["un"]),
            (
                "Banner Roller Up (80x200cm)",
                cat_finished,
                Product.Type.MANUFACTURABLE,
                35000,
                uoms["un"],
            ),
            ("Talonario de Facturas", cat_finished, Product.Type.MANUFACTURABLE, 4500, uoms["un"]),
            (
                "Calendario de Escritorio",
                cat_finished,
                Product.Type.MANUFACTURABLE,
                2800,
                uoms["un"],
            ),
            ("Papel Químico Duplicado", cat_raw, Product.Type.STORABLE, 15000, uoms["resma"]),
            ("Cartulina Sulfatada 300g", cat_raw, Product.Type.STORABLE, 22000, uoms["paquete"]),
            ("Barniz UV Brillo (L)", cat_supplies, Product.Type.STORABLE, 18500, uoms["un"]),
            ("Alambre para Espiral", cat_supplies, Product.Type.STORABLE, 12000, uoms["kg"]),
            (
                "Pegamento para Encuadernación",
                cat_supplies,
                Product.Type.STORABLE,
                9500,
                uoms["un"],
            ),
            ("Plancha Offset GTO", cat_supplies, Product.Type.STORABLE, 4500, uoms["un"]),
            ("Servicio Fotocopiado B/N", cat_services, Product.Type.SERVICE, 40, uoms["hoja"]),
            ("Servicio Encuadernación", cat_services, Product.Type.SERVICE, 1500, uoms["un"]),
            ("Servicio Plastificado A4", cat_services, Product.Type.SERVICE, 800, uoms["un"]),
            ("Corte por Guillotina", cat_services, Product.Type.SERVICE, 500, uoms["un"]),
        ]

        for i, (name, cat, type, price, uom) in enumerate(extra_products):
            # Mix some storable, manufacturable and services
            Product.objects.get_or_create(
                code=f"{cat.prefix}-{100 + i}",
                defaults={
                    "name": name,
                    "category": cat,
                    "product_type": type,
                    "uom": uom,
                    "sale_price": price,
                    "track_inventory": (type == Product.Type.STORABLE),
                    "requires_advanced_manufacturing": (type == Product.Type.MANUFACTURABLE),
                    "receiving_warehouse": wh if type != Product.Type.SERVICE else None,
                },
            )

        # SERVICES
        Product.objects.get_or_create(
            code="SRV-DIS-GRA",
            defaults={
                "name": "Servicio Diseño Gráfico",
                "category": cat_services,
                "product_type": Product.Type.SERVICE,
                "uom": uoms["un"],
                "sale_price": 25000,
                "track_inventory": False,
            },
        )
        Product.objects.get_or_create(
            code="SRV-PRE-PRE",
            defaults={
                "name": "Pre-Prensa y Planchas",
                "category": cat_services,
                "product_type": Product.Type.SERVICE,
                "uom": uoms["un"],
                "sale_price": 15000,
                "track_inventory": False,
            },
        )
        Product.objects.get_or_create(
            code="SRV-VTA-DIN",
            defaults={
                "name": "Servicio con Precio Dinámico",
                "category": cat_services,
                "product_type": Product.Type.SERVICE,
                "uom": uoms["un"],
                "sale_price": 0,
                "is_dynamic_pricing": True,
                "can_be_sold": True,
                "can_be_purchased": False,
                "track_inventory": False,
            },
        )

        return {
            "warehouse": wh,
            "raw_materials": [p_papel, p_tinta_c, p_tinta_m, p_tinta_y, p_tinta_k],
        }

    def _create_subscriptions(self, accounts, suppliers):
        # Create Subscription Products
        # 1. Maintenance Category
        cat_maint, _ = ProductCategory.objects.get_or_create(
            name="Servicios de Mantenimiento",
            defaults={
                "income_account": accounts["sales_service"],
                "expense_account": accounts["expense_general"],
                "prefix": "MNT",
            },
        )

        p_maint_offset, _ = Product.objects.get_or_create(
            code="SUB-MNT-OFF",
            defaults={
                "name": "Mantención Preventiva Offset",
                "category": cat_maint,
                "product_type": Product.Type.SUBSCRIPTION,
                "uom": UoM.objects.get(name="Unidad"),
                "sale_price": 0,  # Expense mostly
                "recurrence_period": Product.RecurrencePeriod.MONTHLY,
                "renewal_notice_days": 7,
                "can_be_sold": False,
                "can_be_purchased": True,
                "track_inventory": False,
            },
        )

        # 2. Utilities
        cat_utilities, _ = ProductCategory.objects.get_or_create(
            name="Servicios Básicos",
            defaults={
                "income_account": accounts["sales_service"],
                "expense_account": accounts["expense_utilities"],
                "prefix": "SB",
            },
        )

        p_electric, _ = Product.objects.get_or_create(
            code="SUB-ELEC",
            defaults={
                "name": "Suministro Eléctrico Taller",
                "category": cat_utilities,
                "product_type": Product.Type.SUBSCRIPTION,
                "uom": UoM.objects.get(name="Unidad"),
                "sale_price": 0,
                "recurrence_period": Product.RecurrencePeriod.MONTHLY,
                "is_variable_amount": True,
                "renewal_notice_days": 5,
                "can_be_sold": False,
                "can_be_purchased": True,
                "track_inventory": False,
            },
        )

        # Create Active Subscriptions

        # Contract for Machine maintenance
        # supplier[1] is Tintas Gráficas SpA (using as example provider)
        Subscription.objects.get_or_create(
            product=p_maint_offset,
            supplier=suppliers[1],
            defaults={
                "start_date": timezone.localdate(),
                "next_payment_date": timezone.localdate() + timezone.timedelta(days=5),
                "amount": 250000,
                "currency": "CLP",
                "status": Subscription.Status.ACTIVE,
                "recurrence_period": Product.RecurrencePeriod.MONTHLY,
                "notes": "Contrato anual de mantenimiento preventivo máquina Heidelberg.",
            },
        )

        # Contract for Electricity (Variable)
        # supplier[2] is Servicios Eléctricos Enel
        Subscription.objects.get_or_create(
            product=p_electric,
            supplier=suppliers[2],
            defaults={
                "start_date": timezone.localdate(),
                "next_payment_date": timezone.localdate() + timezone.timedelta(days=20),
                "amount": 0,  # Variable
                "currency": "CLP",
                "status": Subscription.Status.ACTIVE,
                "recurrence_period": Product.RecurrencePeriod.MONTHLY,
                "notes": "Suministro eléctrico principal. Monto varía según consumo.",
            },
        )

    def _create_opening_balance(self, accounts, partners, total_stock_value=Decimal("0")):
        if JournalEntry.objects.filter(reference="OPEN-2026").exists():
            return

        entry = JournalEntry(
            date=timezone.localdate(),
            description="Asiento de Apertura 2026 (Suscripción y Pago de Capital)",
            reference="OPEN-2026",
            status=JournalEntry.State.POSTED,
        )
        entry._is_system_closing_entry = True
        entry.save()

        owners = partners.get("owners", [])
        num_owners = len(owners)

        if num_owners > 0:
            # 1. Suscripción de Capital (Subscription) = Initial Cash + Initial Stock Value
            total_bank = Decimal("50000000")
            total_subscription = total_bank + total_stock_value
            sub_per_owner = (total_subscription / num_owners).quantize(Decimal("1"))

            owner_accounts = partners.get("owner_accounts", {})

            for owner in owners:
                per_owner_accounts = owner_accounts.get(owner.id, {})
                owner_capital_account = per_owner_accounts.get("capital", accounts["capital"])
                owner_recv_account = per_owner_accounts.get("receivable", accounts["partner_receivable"])

                # Debit: Capital por Cobrar Socios (per-partner sub-account 1.1.05.01.00X)
                JournalItem.objects.create(
                    entry=entry,
                    account=owner_recv_account,
                    debit=sub_per_owner,
                    credit=0,
                    label=f"Suscripción de Capital - {owner.name}",
                    partner=owner,
                )
                # Credit: Capital Social (per-partner sub-account 3.1.01.00X)
                JournalItem.objects.create(
                    entry=entry,
                    account=owner_capital_account,
                    debit=0,
                    credit=sub_per_owner,
                    label=f"Suscripción de Capital - {owner.name}",
                    partner=owner,
                )

                PartnerTransaction.objects.create(
                    partner=owner,
                    transaction_type=PartnerTransaction.Type.EQUITY_SUBSCRIPTION,
                    amount=sub_per_owner,
                    date=timezone.localdate(),
                    description=f"Suscripción Inicial de Capital ({total_subscription:,.0f} total)",
                    journal_entry=entry,
                )

            # 2. Pago de Capital en Efectivo/Banco (Cash Contribution)
            JournalItem.objects.create(
                entry=entry,
                account=accounts["bank"],
                label="Ingreso Aporte Inicial Banco",
                debit=total_bank,
                credit=0,
            )

            val_per_owner = (total_bank / num_owners).quantize(Decimal("1"))
            total_distributed = val_per_owner * num_owners
            diff = total_bank - total_distributed

            for i, owner in enumerate(owners):
                per_owner_accounts = owner_accounts.get(owner.id, {})
                owner_recv_account = per_owner_accounts.get("receivable", accounts["partner_receivable"])
                val = val_per_owner
                if i == 0:
                    val += diff

                # Credit: Capital por Cobrar Socios (reduces debt, per-partner sub-account 1.1.05.01.00X)
                JournalItem.objects.create(
                    entry=entry,
                    account=owner_recv_account,
                    debit=0,
                    credit=val,
                    label=f"Pago Capital (Banco) - {owner.name}",
                    partner=owner,
                )

                PartnerTransaction.objects.create(
                    partner=owner,
                    transaction_type=PartnerTransaction.Type.CAPITAL_CONTRIBUTION_CASH,
                    amount=val,
                    date=timezone.localdate(),
                    description="Pago de Capital en Efectivo (Depósito Bancario)",
                    journal_entry=entry,
                )
        else:
            total_bank = Decimal("50000000")
            JournalItem.objects.create(
                entry=entry,
                account=accounts["bank"],
                label="Ingreso Aporte Inicial",
                debit=total_bank,
                credit=0,
            )
            JournalItem.objects.create(
                entry=entry,
                account=accounts["capital"],
                label="Capital Social Banco",
                debit=0,
                credit=total_bank,
            )

    def _create_groups(self):
        """Creates standard functional groups (departments)."""
        from django.contrib.auth.models import Group

        groups = [
            "Supervisor",
            "Administración",
            "Bodega",
            "Ventas",
            "Diseño",
            "Pre-Prensa",
            "Taller",
            "Terminaciones",
            "Despacho",
        ]

        created_groups = []
        for name in groups:
            group, created = Group.objects.get_or_create(name=name)
            if created:
                created_groups.append(name)

        if created_groups:
            self.stdout.write(f"  Created groups: {', '.join(created_groups)}")

    def _create_all_users(self):
        """Creates a set of common users for the graphic industry demo."""
        from django.contrib.auth.models import Group

        from core.permissions import Roles

        # Ensure functional groups exist
        self._create_groups()

        # User definitions: (username, role_name, rut_body, first_name, last_name, email)
        # role_name now maps to a seeded role group from SEEDED_ROLES
        user_definitions = [
            (
                "admin",
                Roles.SYSTEM_ADMIN,
                "11111111",
                "Admin",
                "Sistema",
                "admin@erpgrafico.com",
            ),
            (
                "gerente",
                "Gerencia",
                "22222222",
                "Gerente",
                "General",
                "gerente@erpgrafico.com",
            ),
            (
                "operador",
                "Producción",
                "33333333",
                "Operador",
                "Producción",
                "operador@erpgrafico.com",
            ),
            (
                "bodega",
                "Bodega y Despacho",
                "44444444",
                "Encargado",
                "Bodega",
                "bodega@erpgrafico.com",
            ),
            (
                "ventas",
                "Ventas",
                "55555555",
                "Ejecutivo",
                "Ventas",
                "ventas@erpgrafico.com",
            ),
            (
                "diseno",
                "Producción",
                "66666666",
                "Diseñador",
                "Gráfico",
                "diseno@erpgrafico.com",
            ),
        ]

        for username, role_name, rut_body, first, last, email in user_definitions:
            # Create system contact for the user
            contact, _ = Contact.objects.get_or_create(
                tax_id=f"{rut_body}-{compute_rut_dv(rut_body)}",
                defaults={
                    "name": f"{first} {last}",
                    "email": email,
                    "contact_name": f"{first} {last}",
                },
            )

            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "email": email,
                    "first_name": first,
                    "last_name": last,
                    "contact": contact,
                    "is_staff": True,
                    "is_superuser": (role_name == Roles.SYSTEM_ADMIN),
                },
            )

            # Ensure contact linkage
            if not user.contact:
                user.contact = contact
                user.save()

            # Assign Role Group (Security Role)
            role_group, _ = Group.objects.get_or_create(name=role_name)
            if not user.groups.filter(name=role_name).exists():
                user.groups.add(role_group)

            # Assign specific groups for workflow testing (Functional Teams)
            if username == "operador":
                user.groups.add(Group.objects.get(name="Taller"))
                user.groups.add(Group.objects.get(name="Terminaciones"))
            elif username == "bodega":
                user.groups.add(Group.objects.get(name="Bodega"))
                user.groups.add(Group.objects.get(name="Despacho"))
            elif username == "ventas":
                user.groups.add(Group.objects.get(name="Ventas"))
            elif username == "diseno":
                user.groups.add(Group.objects.get(name="Diseño"))
                user.groups.add(Group.objects.get(name="Pre-Prensa"))
            elif username == "gerente":
                user.groups.add(Group.objects.get(name="Administración"))
            elif username == "admin":
                # Admin belongs to everyone for demo purposes
                for gname in [
                    "Supervisor",
                    "Bodega",
                    "Ventas",
                    "Pre-Prensa",
                    "Taller",
                    "Terminaciones",
                    "Despacho",
                    "Diseño",
                    "Administración",
                ]:
                    user.groups.add(Group.objects.get(name=gname))

            # Set static password
            user.set_password("111111")
            user.save()

            status = "created" if created else "updated"
            self.stdout.write(
                f"  User '{username}' {status} with password '111111' (Role: {role_name})"
            )

    def _add_initial_stock(self, accounts, partners):
        """
        Creates initial inventory moves and accounting entries for all storable products.
        """
        warehouse = Warehouse.objects.first()
        if not warehouse:
            self.stdout.write(self.style.ERROR("  No warehouse found to add initial stock."))
            return

        initial_inv_account = accounts[
            "capital"
        ]  # Use capital account directly (initial_inventory_account was removed)

        if not initial_inv_account:
            self.stdout.write(self.style.ERROR("  No initial inventory account found."))
            return

        entry = JournalEntry(
            date=timezone.localdate(),
            description="Carga Inicial de Inventario (Demo Data)",
            reference="INIT-STOCK",
            status=JournalEntry.State.POSTED,
        )
        entry._is_system_closing_entry = True
        entry.save()

        # Filter products that should receive initial stock
        # Exclude: advanced manufacturing, services, subscriptions, consumables, and express manufacturing
        products = (
            Product.objects.filter(track_inventory=True)
            .exclude(requires_advanced_manufacturing=True)
            .exclude(product_type__in=[Product.Type.SERVICE, Product.Type.SUBSCRIPTION, Product.Type.CONSUMABLE])
            .exclude(
                mfg_auto_finalize=True  # Exclude express manufacturing products
            )
        )

        total_value = Decimal("0")
        count = 0

        for product in products:
            # Random initial quantity between 5000 and 15000 to support large historical sales
            qty = Decimal(str(random.randint(5000, 15000)))

            # Determine a realistic cost based on sale price (approx 40-70% of sale price)
            if product.sale_price > 0:
                cost = (product.sale_price * Decimal(str(random.uniform(0.4, 0.7)))).quantize(
                    Decimal("1")
                )
            else:
                # Default material costs
                cost = Decimal(str(random.randint(500, 5000)))

            # 1. Create InventoryDocument + confirm via Motor Documental
            # This generates a proper StockMove with source/destination locations.
            # Use get_or_create so this works on fresh databases where seed migrations
            # may not have populated Location objects yet.
            vendor_loc, _ = Location.objects.get_or_create(
                location_type="VENDOR",
                defaults={"name": "Proveedor (Virtual)"}
            )
            internal_loc, _ = Location.objects.get_or_create(
                location_type="INTERNAL",
                warehouse=warehouse,
                defaults={"name": warehouse.name}
            )

            doc = InventoryDocument.objects.create(
                document_type=InventoryDocument.Type.RECEIPT,
                status=InventoryDocument.Status.DRAFT,
                date=timezone.localdate(),
                reference="INIT-STOCK",
                notes="Carga Inicial Demo Data",
            )
            InventoryDocumentDetail.objects.create(
                document=doc,
                product=product,
                source_location=vendor_loc,
                destination_location=internal_loc,
                quantity=qty,
                unit_cost=cost,
            )
            _, generated_moves = InventoryService.confirmar_documento(doc, journal_entry=entry)
            move = generated_moves[0] if generated_moves else None

            # Update product cost PMP - single save with update_fields to track only cost change
            # First, remove the $0 history entry created on product creation (before cost was set)
            product.history.filter(cost_price=0).delete()
            product.cost_price = cost
            product.save(update_fields=["cost_price"])

            # 2. Create Journal Item (Debit Inventory)
            inv_account = product.get_asset_account or accounts["inventory_raw"]
            line_val = qty * cost
            total_value += line_val

            JournalItem.objects.create(
                entry=entry,
                account=inv_account,
                debit=line_val,
                credit=0,
                label=f"Carga Inicial: {product.name}",
            )
            count += 1

        # 3. Create Balanced Equity Entry (Credit) - Split across partners
        if total_value > 0:
            owners = partners.get("owners", [])
            if owners:
                per_owner_value = (total_value / len(owners)).quantize(Decimal("1"))
                allocated_value = Decimal("0")
                owner_accounts = partners.get("owner_accounts", {})

                for i, owner in enumerate(owners):
                    val = per_owner_value if i < len(owners) - 1 else total_value - allocated_value
                    allocated_value += val

                    per_owner_accounts = owner_accounts.get(owner.id, {})
                    owner_recv_account = per_owner_accounts.get("receivable", accounts["partner_receivable"])

                    # Credit: Capital por Cobrar Socios (reduces debt, per-partner sub-account 1.1.05.01.00X)
                    JournalItem.objects.create(
                        entry=entry,
                        account=owner_recv_account,
                        debit=0,
                        credit=val,
                        label=f"Pago Capital (Inventario) - {owner.name}",
                        partner=owner,
                    )

                    PartnerTransaction.objects.create(
                        partner=owner,
                        transaction_type=PartnerTransaction.Type.CAPITAL_CONTRIBUTION_INVENTORY,
                        amount=val,
                        date=timezone.localdate(),
                        description="Pago de Capital en Especies (Inventario Inicial)",
                        journal_entry=entry,
                    )
            else:
                JournalItem.objects.create(
                    entry=entry,
                    account=initial_inv_account,
                    debit=0,
                    credit=total_value,
                    label="Contrapartida Carga Inicial Inventario",
                )

        self.stdout.write(
            f"  ✓ Initial stock added for {count} products. Total value: ${total_value:,.0f}"
        )
        return total_value

    def _create_treasury_infrastructure(self, accounts, partners):
        self.stdout.write("  Creating POS Terminals and Treasury Physical Accounts...")

        # 0. Create Banks
        b_estado, _ = Bank.objects.get_or_create(
            code="ESTADO", defaults={"name": "Banco Estado", "is_active": True}
        )
        b_chile, _ = Bank.objects.get_or_create(
            code="CHILE", defaults={"name": "Banco de Chile", "is_active": True}
        )
        b_santander, _ = Bank.objects.get_or_create(
            code="SANTANDER", defaults={"name": "Banco Santander", "is_active": True}
        )
        b_bci, _ = Bank.objects.get_or_create(
            code="BCI", defaults={"name": "Banco BCI", "is_active": True}
        )
        # Banco de Ripley archivado de demo — usado para exhibir el patrón
        # "Archivo" del ADR-0037 (is_active=False, fuera de selectores, no se borra).
        b_ripley, _ = Bank.objects.get_or_create(
            code="RIPLEY",
            defaults={"name": "Banco Ripley (Demo Archivo)", "is_active": False},
        )

        # 1. Create Physical Treasury Accounts with UNIQUE Accounting Accounts

        # Helper to get/create specific cash account
        cash_parent = accounts["cash"].parent if accounts["cash"].parent else accounts["cash"]

        def get_create_cash_account(code, name):
            acc, _ = Account.objects.get_or_create(
                code=code,
                defaults={
                    "name": name,
                    "account_type": AccountType.ASSET,
                    "parent": cash_parent,
                    "is_reconcilable": True,
                    "bs_category": BSCategory.CURRENT_ASSET,  # Explicitly for Liquidity Ratio
                },
            )
            return acc

        def get_create_liability_account(code, name):
            """Crea cuenta de pasivo bajo 2.1 (Pasivos Corrientes) para tarjetas de crédito."""
            parent = Account.objects.get(code="2.1")
            acc, _ = Account.objects.get_or_create(
                code=code,
                defaults={
                    "name": name,
                    "account_type": AccountType.LIABILITY,
                    "parent": parent,
                    "is_reconcilable": True,
                    "bs_category": BSCategory.CURRENT_LIABILITY,
                },
            )
            return acc

        # Safe Account (1.1.01.01 - reusing main cash or creating specific)
        acc_safe = get_create_cash_account("1.1.01.11", "Efectivo Caja Fuerte")
        safe, _ = TreasuryAccount.objects.get_or_create(
            code="CAJA-FUERTE",
            defaults={
                "name": "Caja Fuerte (Tesorería Central)",
                "currency": "CLP",
                "account": acc_safe,
                "account_type": TreasuryAccount.Type.CASH,
                "allows_cash": True,
            },
        )

        # Default Payment Method for Safe
        PaymentMethod.objects.get_or_create(
            name="Efectivo Tesorería Central",
            treasury_account=safe,
            defaults={
                "method_type": PaymentMethod.Type.CASH,
                "allow_for_sales": True,
                "allow_for_purchases": True,
            },
        )

        # Till 1 Account
        acc_till1 = get_create_cash_account("1.1.01.12", "Efectivo Caja POS 01")
        till1, _ = TreasuryAccount.objects.get_or_create(
            code="CAJA-POS-01",
            defaults={
                "name": "Caja Física POS 01",
                "currency": "CLP",
                "account": acc_till1,
                "account_type": TreasuryAccount.Type.CASH,
                "allows_cash": True,
            },
        )

        # Default Payment Method for Till 1
        PaymentMethod.objects.get_or_create(
            name="Efectivo (Recaudación POS 01)",
            treasury_account=till1,
            defaults={
                "method_type": PaymentMethod.Type.CASH,
                "allow_for_sales": True,
                "allow_for_purchases": True,
            },
        )
        # Petty Cash Account
        acc_petty = get_create_cash_account("1.1.01.13", "Efectivo Caja Chica")
        petty, _ = TreasuryAccount.objects.get_or_create(
            code="CAJA-CHICA",
            defaults={
                "name": "Caja Chica (Fondo Fijo)",
                "currency": "CLP",
                "account": acc_petty,
                "account_type": TreasuryAccount.Type.CASH,
                "allows_cash": True,
            },
        )

        # Default Payment Method for Petty Cash
        PaymentMethod.objects.get_or_create(
            name="Efectivo Fondo Fijo Adm.",
            treasury_account=petty,
            defaults={
                "method_type": PaymentMethod.Type.CASH,
                "allow_for_sales": False,
                "allow_for_purchases": True,
            },
        )

        # 1.1 New Additional Accounts
        # Cada cuenta corriente debe tener su propia sub-cuenta contable
        # (regla del wizard F5.1 y del ADR-0037). Antes: ambos bancos
        # compartían 1.1.01.02 y 1.1.01.03 a nivel de sub-ledger.
        acc_banco_estado = get_create_cash_account("1.1.01.20", "Banco Estado (Cta Corriente)")
        bco01, _ = TreasuryAccount.objects.get_or_create(
            code="BCO-ESTADO",
            defaults={
                "name": "Banco Estado Empresa",
                "currency": "CLP",
                "account": acc_banco_estado,
                "account_type": TreasuryAccount.Type.CHECKING,
                "account_number": "123-45678-01",
                "allows_cash": False,
                "allows_card": True,
                "allows_transfer": True,
                "bank": b_estado,
            },
        )

        # Payment Methods for Bank Account (Estado)
        pm_trans_est, _ = PaymentMethod.objects.get_or_create(
            name="Transferencia Estado",
            treasury_account=bco01,
            defaults={
                "method_type": PaymentMethod.Type.TRANSFER,
                "allow_for_sales": True,
                "allow_for_purchases": True,
            },
        )

        # Workshop Till Account
        acc_workshop = get_create_cash_account("1.1.01.14", "Efectivo Caja Taller")
        caja01, _ = TreasuryAccount.objects.get_or_create(
            code="CAJA-TALLER",
            defaults={
                "name": "Caja Física Taller",
                "currency": "CLP",
                "account": acc_workshop,
                "account_type": TreasuryAccount.Type.CASH,
                "allows_cash": True,
            },
        )

        # Payment Method for Workshop
        pm_efectivo_taller, _ = PaymentMethod.objects.get_or_create(
            name="Efectivo (Pagos Taller)",
            treasury_account=caja01,
            defaults={
                "method_type": PaymentMethod.Type.CASH,
                "allow_for_sales": True,
                "allow_for_purchases": True,
            },
        )

        acc_banco_chile = get_create_cash_account("1.1.01.21", "Banco de Chile (Cta Corriente)")
        bank_chile, _ = TreasuryAccount.objects.get_or_create(
            code="BCO-CHILE",
            defaults={
                "name": "Banco de Chile (Cta Corriente)",
                "currency": "CLP",
                "account": acc_banco_chile,
                "account_type": TreasuryAccount.Type.CHECKING,
                "account_number": "987-65432-09",
                "allows_cash": False,
                "allows_card": True,
                "allows_transfer": True,
                "bank": b_chile,
            },
        )

        # Payment Methods for Bank Account (Chile)
        PaymentMethod.objects.get_or_create(
            name="Transferencia Bco Chile",
            treasury_account=bank_chile,
            defaults={
                "method_type": PaymentMethod.Type.TRANSFER,
                "allow_for_sales": True,
                "allow_for_purchases": True,
            },
        )

        # Cta corriente BCI para exhibir más bancos y más cuentas
        acc_banco_bci = get_create_cash_account("1.1.01.22", "Banco BCI (Cta Corriente)")
        bank_bci, _ = TreasuryAccount.objects.get_or_create(
            code="BCO-BCI",
            defaults={
                "name": "Banco BCI (Cta Corriente)",
                "currency": "CLP",
                "account": acc_banco_bci,
                "account_type": TreasuryAccount.Type.CHECKING,
                "account_number": "111-22233-44",
                "allows_cash": False,
                "allows_card": True,
                "allows_transfer": True,
                "bank": b_bci,
            },
        )
        PaymentMethod.objects.get_or_create(
            name="Transferencia BCI",
            treasury_account=bank_bci,
            defaults={
                "method_type": PaymentMethod.Type.TRANSFER,
                "allow_for_sales": True,
                "allow_for_purchases": True,
            },
        )

        # Tarjeta de crédito corporativa (CREDIT_CARD) — usa cuenta de pasivo
        # 2.1.04.02 creada en populate_ifrs_coa.
        acc_cc_chile = get_create_liability_account("2.1.04.02.01", "Tarjeta de Crédito Visa Chile")
        card_chile, _ = TreasuryAccount.objects.get_or_create(
            code="TC-VISA-CHILE",
            defaults={
                "name": "Visa Empresas Banco de Chile",
                "currency": "CLP",
                "account": acc_cc_chile,
                "account_type": TreasuryAccount.Type.CREDIT_CARD,
                "account_number": "4500-XXXX-XXXX-1234",
                "card_number": "4500 1234 5678 1234",
                "credit_limit": Decimal("5000000"),
                "allows_cash": False,
                "allows_card": True,
                "allows_transfer": False,
                "bank": b_chile,
            },
        )
        # Default payment method for corporate credit card
        PaymentMethod.objects.get_or_create(
            name="Tarjeta Crédito Visa Chile",
            treasury_account=card_chile,
            defaults={
                "method_type": PaymentMethod.Type.CREDIT_CARD,
                "allow_for_sales": False,
                "allow_for_purchases": True,
            },
        )

        # Reception Till Account
        acc_reception = get_create_cash_account("1.1.01.15", "Efectivo Caja Recepción")
        recepcion, _ = TreasuryAccount.objects.get_or_create(
            code="CAJA-REC",
            defaults={
                "name": "Caja Recepción Local",
                "currency": "CLP",
                "account": acc_reception,
                "account_type": TreasuryAccount.Type.CASH,
                "allows_cash": True,
            },
        )

        # Payment Methods for Reception
        PaymentMethod.objects.get_or_create(
            name="Efectivo Recepción",
            treasury_account=recepcion,
            defaults={
                "method_type": PaymentMethod.Type.CASH,
                "allow_for_sales": True,
                "allow_for_purchases": True,
            },
        )
        pm_webpay, _ = PaymentMethod.objects.get_or_create(
            name="Webpay / Transbank",
            treasury_account=bco01,
            defaults={
                "method_type": PaymentMethod.Type.CARD,
                "allow_for_sales": True,
                "allow_for_purchases": False,
            },
        )

        # 1.2 TUU Integration Infrastructure
        # Bridge account: clearing between card payment capture and bank settlement.
        acc_tuu_bridge = get_create_cash_account("1.1.01.16", "Cuenta Puente Liquidación TUU")
        tuu_bridge, _ = TreasuryAccount.objects.get_or_create(
            code="PUENTE-TUU",
            defaults={
                "name": "Cuenta Puente Liquidación TUU",
                "currency": "CLP",
                "account": acc_tuu_bridge,
                "account_type": TreasuryAccount.Type.BRIDGE,
                "allows_cash": False,
            },
        )

        tuu_contact, _ = Contact.objects.get_or_create(
            tax_id="76.354.771-K", defaults={"name": "TUU SpA", "email": "soporte@tuu.cl"}
        )

        # Service product for commissions
        cat_services = ProductCategory.objects.get(name="Servicios Gráficos")
        uom_un = UoM.objects.get(name="Unidad")
        p_commission, _ = Product.objects.get_or_create(
            code="SRV-COMM-TERM",
            defaults={
                "name": "Comisión Terminal de Pago",
                "category": cat_services,
                "product_type": Product.Type.SERVICE,
                "uom": uom_un,
                "sale_price": 0,
                "can_be_sold": False,
                "can_be_purchased": True,
                "track_inventory": False,
            },
        )

        tuu_provider, _ = PaymentTerminalProvider.objects.update_or_create(
            name="TUU",
            defaults={
                "provider_type": PaymentTerminalProvider.ProviderType.TUU,
                "supplier": tuu_contact,
                "receivable_account": acc_tuu_bridge,
                "commission_expense_account": accounts["bank_commission"],
                "commission_iva_account": accounts["vat_credit"],
                "commission_product": p_commission,
                "bank_treasury_account": tuu_bridge,
                "default_deposit_account": bco01,
                "is_active": True,
            },
        )

        tuu_provider.refresh_from_db()
        if tuu_provider.bank_treasury_account_id != tuu_bridge.id:
            raise CommandError(
                f"Fallo al vincular el proveedor TUU con la cuenta puente "
                f"({tuu_bridge.code!r} / id={tuu_bridge.id}). "
                f"bank_treasury_account quedó apuntando a "
                f"id={tuu_provider.bank_treasury_account_id} en lugar de "
                f"id={tuu_bridge.id}. Esto suele indicar drift de datos en la BD "
                f"(el provider se creó en una versión anterior del esquema o con "
                f"otro valor para el FK). Diagnostique con "
                f"`python manage.py audit_terminal_provider_links` y, si es "
                f"necesario, re-ejecute con `--purge` o arregle el FK a mano."
            )
        if not tuu_bridge.terminal_providers.filter(pk=tuu_provider.pk).exists():
            raise CommandError(
                f"Inconsistencia: el provider TUU (pk={tuu_provider.pk}) tiene "
                f"bank_treasury_account apuntando a la cuenta puente, pero la "
                f"relación inversa tuu_bridge.terminal_providers no la ve. "
                f"Reintente con `--purge` o revise `audit_terminal_provider_links`."
            )
        tuu_device, _ = PaymentTerminalDevice.objects.get_or_create(
            serial_number="TUU-DEMO-001",
            defaults={
                "name": "TUU POS-01",
                "provider": tuu_provider,
                "status": PaymentTerminalDevice.Status.ACTIVE,
            },
        )

        # 2. POS Terminals

        # Método CHECK vinculado a la cuenta puente CHEQUES-CARTERA (creado por ensure_portfolio_account).
        from treasury.models import TreasuryAccount as TA

        check_portfolio = TA.objects.filter(account_type=TA.Type.CHECK_PORTFOLIO).first()
        check_pm = (
            PaymentMethod.objects.filter(
                method_type=PaymentMethod.Type.CHECK,
                treasury_account=check_portfolio,
            ).first()
            if check_portfolio
            else None
        )

        # POS-01: Caja Central P1 — con device TUU integrado.
        # post_save signal auto-crea método CARD_TERMINAL y lo agrega a allowed_payment_methods.
        t1, t1_created = POSTerminal.objects.get_or_create(
            code="POS-01",
            defaults={
                "name": "Caja Central P1",
                "location": "Planta 1 - Recepción",
                "ip_address": "192.168.1.100",
                "default_treasury_account": till1,
                "payment_terminal_device": tuu_device,
            },
        )
        if not t1_created and t1.payment_terminal_device != tuu_device:
            t1.payment_terminal_device = tuu_device
            t1.save()  # Triggers signal → auto-creates CARD_TERMINAL method
        cash_pm_01 = PaymentMethod.objects.get(name="Efectivo (Recaudación POS 01)")
        # Signal already added CARD_TERMINAL; ensure cash and check are also present
        t1.allowed_payment_methods.add(cash_pm_01)
        if check_pm:
            t1.allowed_payment_methods.add(check_pm)

        # POS-02: Caja Taller P2
        t2, t2_created = POSTerminal.objects.get_or_create(
            code="POS-02",
            defaults={
                "name": "Caja Taller P2",
                "location": "Planta 2 - Taller",
                "ip_address": "192.168.1.100",
                "default_treasury_account": caja01,
            },
        )
        # Association per screenshot: Efectivo Taller + Webpay / Transbank
        t2.allowed_payment_methods.set([pm_efectivo_taller, pm_webpay])
        if check_pm:
            t2.allowed_payment_methods.add(check_pm)

        # La cuenta por defecto de cada caja es la cuenta de su método de
        # efectivo (misma regla que aplica PosTerminalDrawer al guardar): de
        # ella salen el saldo base de apertura y el efectivo esperado del
        # cuadre. Se fuerza también en re-ejecuciones sin --purge para sanear
        # terminales sembrados antes con Banco Estado como default.
        POSTerminal.objects.filter(pk=t1.pk).update(default_treasury_account=till1)
        POSTerminal.objects.filter(pk=t2.pk).update(default_treasury_account=caja01)

        # Ensure cashier user is linked to sessions correctly (Optional but good for demo)
        self.stdout.write(
            "    ✓ Infrastructure created (Banks, Terminals, Safe, Tills, refined Payment Methods)."
        )

    def _create_credit_lines(self):
        """Crea líneas de crédito (sobregiro) para cuentas CHECKING del demo."""
        from datetime import date

        checking_accounts = TreasuryAccount.objects.filter(
            account_type=TreasuryAccount.Type.CHECKING,
        )
        for ta in checking_accounts:
            CreditLine.objects.get_or_create(
                treasury_account=ta,
                defaults={
                    "code": f"CL-{ta.code}",
                    "currency": ta.currency,
                    "credit_limit": Decimal("20000000"),
                    "interest_rate": Decimal("1.5"),
                    "rate_basis": CreditLine.RateBasis.MONTHLY,
                    "valid_from": date(2026, 1, 1),
                    "valid_until": date(2028, 12, 31),
                    "status": CreditLine.Status.ACTIVE,
                },
            )

    def _create_periods(self):
        """Creates tax and accounting periods for the current year — all OPEN.

        Periods are closed later by _close_past_periods() after all
        transactions and F29 declarations have been created.
        """
        current_year = timezone.now().year
        periods = []
        for month in range(1, 13):
            tax_period, _ = TaxPeriod.objects.get_or_create(
                year=current_year, month=month,
                defaults={"status": TaxPeriod.Status.OPEN},
            )
            acc_period, _ = AccountingPeriod.objects.get_or_create(
                year=current_year, month=month,
                defaults={
                    "status": AccountingPeriod.Status.OPEN,
                    "tax_period": tax_period,
                },
            )
            periods.append({"tax": tax_period, "acc": acc_period})

        self.stdout.write(f"    ✓ {len(periods)} periods created (all OPEN) for {current_year}.")
        return periods

    def _create_loans_demo(self, accounts, partners):
        from treasury.loan_service import LoanService

        admin = User.objects.filter(is_superuser=True).first()
        if BankLoan.objects.filter(loan_number="DEMO-LOAN-001").exists():
            self.stdout.write("  ✓ Préstamo demo ya existe, saltando.")
            return

        self.stdout.write("  ─────────────────────────────────────────────")
        bank_estado = Bank.objects.get(code="ESTADO")
        bco_estado = TreasuryAccount.objects.get(code="BCO-ESTADO")

        parent_liability = Account.objects.get(code="2.1.04")
        acc_loan_liability, _ = Account.objects.get_or_create(
            code="2.1.04.10",
            defaults={
                "name": "Préstamos Bancarios por Pagar",
                "account_type": AccountType.LIABILITY,
                "parent": parent_liability,
                "is_reconcilable": True,
                "bs_category": BSCategory.CURRENT_LIABILITY,
            },
        )
        loan_liability_ta, _ = TreasuryAccount.objects.get_or_create(
            code="PASIVO-PRESTAMO-001",
            defaults={
                "name": "Préstamo Bancario por Pagar (Demo)",
                "currency": "CLP",
                "account": acc_loan_liability,
                "account_type": TreasuryAccount.Type.LOAN,
            },
        )

        loan = BankLoan.objects.create(
            lender=bank_estado,
            loan_number="DEMO-LOAN-001",
            currency=BankLoan.Currency.CLP,
            principal=Decimal("10000000"),
            interest_rate=Decimal("1.2"),
            rate_basis=BankLoan.RateBasis.MONTHLY,
            amortization_system=BankLoan.AmortizationSystem.FRENCH,
            term_months=12,
            start_date=timezone.localdate(),
            first_due_date=timezone.localdate() + timezone.timedelta(days=30),
            insurance_monthly=Decimal("5000"),
            opening_fee=Decimal("50000"),
            stamp_tax=Decimal("10000"),
            penalty_rate=Decimal("1.5"),
            disbursement_account=bco_estado,
            liability_account=loan_liability_ta,
            status=BankLoan.Status.DRAFT,
        )
        self.stdout.write(
            f"  ✓ Préstamo {loan.display_id} creado: "
            f"${loan.principal:,.0f} @ {loan.interest_rate}% / {loan.term_months} cuotas"
        )

        settings = AccountingSettings.get_solo()
        loan = LoanService.disburse(
            loan,
            created_by=admin,
            commission_expense_account=settings.loan_commission_expense_account,
            stamp_tax_expense_account=settings.loan_stamp_tax_expense_account,
        )
        first_inst = loan.installments.filter(number=1).first()
        n_inst = loan.installments.count()
        self.stdout.write(
            f"  ✓ Schedule generado: {n_inst} cuotas (cuota fija: ${first_inst.total_amount:,.0f})"
        )
        net_cash = loan.principal - loan.opening_fee - loan.stamp_tax
        self.stdout.write(
            f"  ✓ Desembolso → BCO-ESTADO: ${net_cash:,.0f} neto "
            f"(capital ${loan.principal:,.0f} - com ${loan.opening_fee:,.0f} - ITE ${loan.stamp_tax:,.0f})"
        )

        LoanService.pay_installment(
            loan,
            first_inst,
            payment_account=bco_estado,
            interest_expense_account=accounts["interest_expense"],
            insurance_expense_account=accounts["insurance_expense"],
            created_by=admin,
        )
        first_inst.refresh_from_db()
        self.stdout.write(
            f"  ✓ Cuota #1 pagada: ${first_inst.total_amount:,.0f} "
            f"(capital: ${first_inst.principal_amount:,.0f} + "
            f"interés: ${first_inst.interest_amount:,.0f} + "
            f"seguro: ${first_inst.insurance_amount:,.0f})"
        )
        self.stdout.write("  ── 1 préstamo, 1 desembolso, 1 cuota pagada")

        # ── Segundo préstamo: Banco de Chile ───────────────────────────
        if not BankLoan.objects.filter(loan_number="DEMO-LOAN-002").exists():
            bank_chile = Bank.objects.get(code="CHILE")
            bco_chile = TreasuryAccount.objects.get(code="BCO-CHILE")

            acc_loan_liability2, _ = Account.objects.get_or_create(
                code="2.1.04.11",
                defaults={
                    "name": "Préstamo Banco Chile por Pagar",
                    "account_type": AccountType.LIABILITY,
                    "parent": parent_liability,
                    "is_reconcilable": True,
                    "bs_category": BSCategory.CURRENT_LIABILITY,
                },
            )
            loan_liability_ta2, _ = TreasuryAccount.objects.get_or_create(
                code="PASIVO-PRESTAMO-002",
                defaults={
                    "name": "Préstamo Banco Chile por Pagar (Demo)",
                    "currency": "CLP",
                    "account": acc_loan_liability2,
                    "account_type": TreasuryAccount.Type.LOAN,
                },
            )

            loan2 = BankLoan.objects.create(
                lender=bank_chile,
                loan_number="DEMO-LOAN-002",
                currency=BankLoan.Currency.CLP,
                principal=Decimal("15000000"),
                interest_rate=Decimal("1.0"),
                rate_basis=BankLoan.RateBasis.MONTHLY,
                amortization_system=BankLoan.AmortizationSystem.FRENCH,
                term_months=6,
                start_date=timezone.localdate(),
                first_due_date=timezone.localdate() + timezone.timedelta(days=30),
                insurance_monthly=Decimal("3000"),
                opening_fee=Decimal("30000"),
                stamp_tax=Decimal("5000"),
                penalty_rate=Decimal("1.5"),
                disbursement_account=bco_chile,
                liability_account=loan_liability_ta2,
                status=BankLoan.Status.DRAFT,
            )
            self.stdout.write(
                f"  ✓ Préstamo {loan2.display_id} creado: "
                f"${loan2.principal:,.0f} @ {loan2.interest_rate}% / {loan2.term_months} cuotas"
            )

            settings = AccountingSettings.get_solo()
            loan2 = LoanService.disburse(
                loan2,
                created_by=admin,
                commission_expense_account=settings.loan_commission_expense_account,
                stamp_tax_expense_account=settings.loan_stamp_tax_expense_account,
            )
            first_inst2 = loan2.installments.filter(number=1).first()
            n_inst2 = loan2.installments.count()
            self.stdout.write(
                f"  ✓ Schedule generado: {n_inst2} cuotas (cuota fija: ${first_inst2.total_amount:,.0f})"
            )
            net_cash2 = loan2.principal - loan2.opening_fee - loan2.stamp_tax
            self.stdout.write(
                f"  ✓ Desembolso → BCO-CHILE: ${net_cash2:,.0f} neto "
                f"(capital ${loan2.principal:,.0f} - com ${loan2.opening_fee:,.0f} - ITE ${loan2.stamp_tax:,.0f})"
            )

        else:
            self.stdout.write("  ✓ Préstamo DEMO-LOAN-002 ya existe, saltando.")

    def _initialize_company_settings(self):
        """
        Creates or updates the singleton CompanySettings and links it to
        the internal company contact.
        """
        # Create/Get Internal Company Contact
        contact, created = Contact.objects.get_or_create(
            tax_id="76.000.000-0",
            defaults={
                "name": "Mi Empresa ERP",
                "email": "administracion@miempresa.cl",
                "phone": "+56 9 1234 5678",
                "address": "Av. Principal 123, Santiago, Chile",
            },
        )
        if created:
            self.stdout.write(f"  ✓ Created internal company contact: {contact.name}")

        # Initialize Company Settings
        settings, _ = CompanySettings.objects.update_or_create(
            id=1,  # Ensure it's the singleton
            defaults={
                "name": "Mi Empresa ERP",
                "tax_id": "76.000.000-0",
                "email": "administracion@miempresa.cl",
                "phone": "+56 9 1234 5678",
                "address": "Av. Principal 123, Santiago, Chile",
                "business_activity": "Servicios de Impresión y Diseño",
                "contact": contact,
            },
        )
        self.stdout.write("  ✓ Initialized/Updated company settings singleton")

        # Initialize Reconciliation Settings with 100% weight to amount
        ReconciliationSettings.objects.update_or_create(
            treasury_account=None,
            defaults={
                "amount_weight": 100,
                "date_weight": 0,
                "reference_weight": 0,
                "contact_weight": 0,
                "confidence_threshold": 95,
                "date_range_days": 30,
                "auto_confirm": False,
            },
        )
        self.stdout.write("  ✓ Global Reconciliation Settings initialized (100% Amount Weight)")

    def _create_hr_demo_data(self, accounts):
        """Seeds Chilean HR parameters, AFPs, and Concepts."""
        # 1. Global HR Settings
        hr_settings, _ = GlobalHRSettings.objects.get_or_create(
            id=1,
            defaults={
                "uf_current_value": Decimal("37000.00"),
                "utm_current_value": Decimal("65000.00"),
                "min_wage_value": Decimal("500000.00"),
            },
        )
        self.stdout.write("    ✓ Global HR Settings initialized.")

        # Also set HR accounts in AccountingSettings
        from accounting.models import AccountingSettings

        acct_settings = AccountingSettings.get_solo()
        acct_settings.account_remuneraciones_por_pagar = accounts["salary_payable"]
        acct_settings.account_previred_por_pagar = accounts["previred_payable"]
        acct_settings.account_anticipos = accounts["salary_advance"]
        acct_settings.save()
        self.stdout.write("    ✓ HR accounts set in AccountingSettings.")

        # 2. AFPs
        afps_data = [
            ("Habitat", Decimal("11.27")),
            ("Provida", Decimal("11.45")),
            ("Modelo", Decimal("10.58")),
        ]
        for name, pct in afps_data:
            AFP.objects.get_or_create(
                name=name, defaults={"percentage": pct, "account": accounts["previred_payable"]}
            )
        self.stdout.write("    ✓ Standard AFPs created.")

        # 3. Payroll Concepts
        concepts_data = [
            # Haberes Imponibles
            {
                "name": "Sueldo Base",
                "category": PayrollConcept.Category.HABER_IMPONIBLE,
                "account": accounts["expense_salary"],
                "formula_type": PayrollConcept.FormulaType.FIXED,
                "is_system": True,
            },
            {
                "name": "Gratificación Legal",
                "category": PayrollConcept.Category.HABER_IMPONIBLE,
                "account": accounts["expense_salary"],
                "formula_type": PayrollConcept.FormulaType.FORMULA,
                "formula": "min(IMPONIBLE * 0.25, (4.75 * MIN_WAGE) / 12)",
                "is_system": True,
            },
            # Haberes No Imponibles
            {
                "name": "Asignación de Colación",
                "category": PayrollConcept.Category.HABER_NO_IMPONIBLE,
                "account": Account.objects.get(code="5.2.18"),
                "formula_type": PayrollConcept.FormulaType.EMPLOYEE_SPECIFIC,
                "is_system": True,
            },
            {
                "name": "Asignación de Movilización",
                "category": PayrollConcept.Category.HABER_NO_IMPONIBLE,
                "account": Account.objects.get(code="5.2.18"),
                "formula_type": PayrollConcept.FormulaType.EMPLOYEE_SPECIFIC,
                "is_system": True,
            },
            {
                "name": "Seguro Cesantía (Aporte Trabajador)",
                "category": PayrollConcept.Category.DESCUENTO_LEGAL_TRABAJADOR,
                "account": accounts["previred_payable"],
                "formula_type": PayrollConcept.FormulaType.FORMULA,
                "formula": "IMPONIBLE * 0.006 if (CONTRATO_INDEFINIDO and CONTRACT_YEARS <= 11) else 0",
                "is_system": True,
            },
            # Descuentos Legales (Empleador)
            {
                "name": "AFP (Descuento)",
                "category": PayrollConcept.Category.DESCUENTO_LEGAL_TRABAJADOR,
                "account": accounts["previred_payable"],
                "formula_type": PayrollConcept.FormulaType.FORMULA,
                "formula": "IMPONIBLE * AFP_PERCENT",
                "is_system": True,
            },
            {
                "name": "Salud",
                "category": PayrollConcept.Category.DESCUENTO_LEGAL_TRABAJADOR,
                "account": accounts["previred_payable"],
                "formula_type": PayrollConcept.FormulaType.FORMULA,
                "formula": "max(IMPONIBLE * 0.07, ISAPRE_UF * UF)",
                "is_system": True,
            },
            {
                "name": "AFP (Aporte Empleador)",
                "category": PayrollConcept.Category.DESCUENTO_LEGAL_EMPLEADOR,
                "account": accounts["expense_prevision"],
                "formula_type": PayrollConcept.FormulaType.PERCENTAGE,
                "default_amount": Decimal("0.10"),
                "is_system": True,
            },
            {
                "name": "Seguro Social (Cotización expectativa de vida)",
                "category": PayrollConcept.Category.DESCUENTO_LEGAL_EMPLEADOR,
                "account": accounts["expense_prevision"],
                "formula_type": PayrollConcept.FormulaType.PERCENTAGE,
                "default_amount": Decimal("0.90"),
                "is_system": True,
            },
            {
                "name": "SIS (Seguro Invalidez)",
                "category": PayrollConcept.Category.DESCUENTO_LEGAL_EMPLEADOR,
                "account": accounts["expense_prevision"],
                "formula_type": PayrollConcept.FormulaType.PERCENTAGE,
                "default_amount": Decimal("1.54"),
                "is_system": True,
            },
            {
                "name": "Ley Accidente de trabajo",
                "category": PayrollConcept.Category.DESCUENTO_LEGAL_EMPLEADOR,
                "account": accounts["expense_prevision"],
                "formula_type": PayrollConcept.FormulaType.PERCENTAGE,
                "default_amount": Decimal("0.93"),
                "is_system": True,
            },
            {
                "name": "Seguro Cesantía (Aporte Empleador)",
                "category": PayrollConcept.Category.DESCUENTO_LEGAL_EMPLEADOR,
                "account": accounts["expense_prevision"],
                "formula_type": PayrollConcept.FormulaType.FORMULA,
                "formula": "IMPONIBLE * 0.008 if (CONTRATO_INDEFINIDO and CONTRACT_YEARS > 11) else (IMPONIBLE * 0.024 if CONTRATO_INDEFINIDO else IMPONIBLE * 0.03)",
                "is_system": True,
            },
            # Otros
            {
                "name": "Anticipo de Sueldo",
                "category": PayrollConcept.Category.OTRO_DESCUENTO,
                "account": accounts["salary_advance"],
                "formula_type": PayrollConcept.FormulaType.FIXED,
                "is_system": True,
            },
        ]

        for data in concepts_data:
            name = data.pop("name")
            PayrollConcept.objects.update_or_create(name=name, defaults=data)
        self.stdout.write("    ✓ Payroll Concepts created.")

        # 4. Demo Employees
        from datetime import date

        from hr.services import PayrollPaymentService, PayrollService, post_payroll

        employees_data = [
            {
                "tax_id": f"11111111-{compute_rut_dv('11111111')}",
                "position": "Gerente de Operaciones",
                "department": "Gerencia",
                "base_salary": Decimal("590000"),
                "afp_name": "Habitat",
                "salud_type": Employee.SaludType.FONASA,
                "jornada_type": Employee.JornadaType.ORDINARIA_22,
                "jornada_hours": Decimal("44.00"),
                "contract_type": Employee.ContractType.INDEFINIDO,
                "trabajo_pesado": False,
                "asignacion_familiar": Employee.AsignacionFamiliarTramo.TRAMO_D,
                "cargas_familiares": 0,
                "colacion": Decimal("65000"),
                "movilizacion": Decimal("45000"),
            },
            {
                "tax_id": f"22222222-{compute_rut_dv('22222222')}",
                "position": "Jefe de Ventas",
                "department": "Ventas",
                "base_salary": Decimal("580000"),
                "afp_name": "Provida",
                "salud_type": Employee.SaludType.FONASA,
                "jornada_type": Employee.JornadaType.ORDINARIA_22,
                "jornada_hours": Decimal("44.00"),
                "contract_type": Employee.ContractType.INDEFINIDO,
                "trabajo_pesado": False,
                "asignacion_familiar": Employee.AsignacionFamiliarTramo.TRAMO_B,
                "cargas_familiares": 2,
                "colacion": Decimal("55000"),
                "movilizacion": Decimal("40000"),
            },
            {
                "tax_id": f"33333333-{compute_rut_dv('33333333')}",
                "position": "Operador de Máquina Offset",
                "department": "Taller",
                "base_salary": Decimal("570000"),
                "afp_name": "Modelo",
                "salud_type": Employee.SaludType.FONASA,
                "jornada_type": Employee.JornadaType.ORDINARIA_22,
                "jornada_hours": Decimal("44.00"),
                "contract_type": Employee.ContractType.INDEFINIDO,
                "trabajo_pesado": True,
                "asignacion_familiar": Employee.AsignacionFamiliarTramo.TRAMO_A,
                "cargas_familiares": 3,
                "colacion": Decimal("50000"),
                "movilizacion": Decimal("35000"),
            },
            {
                "tax_id": f"44444444-{compute_rut_dv('44444444')}",
                "position": "Encargado de Bodega",
                "department": "Bodega",
                "base_salary": Decimal("550000"),
                "afp_name": "Habitat",
                "salud_type": Employee.SaludType.FONASA,
                "jornada_type": Employee.JornadaType.PARCIAL_40BIS,
                "jornada_hours": Decimal("36.00"),
                "contract_type": Employee.ContractType.INDEFINIDO,
                "trabajo_pesado": False,
                "asignacion_familiar": Employee.AsignacionFamiliarTramo.TRAMO_C,
                "cargas_familiares": 1,
                "colacion": Decimal("45000"),
                "movilizacion": Decimal("30000"),
            },
            {
                "tax_id": f"55555555-{compute_rut_dv('55555555')}",
                "position": "Ejecutivo de Ventas",
                "department": "Ventas",
                "base_salary": Decimal("560000"),
                "afp_name": "Provida",
                "salud_type": Employee.SaludType.ISAPRE,
                "isapre_amount_uf": Decimal("1.5000"),
                "jornada_type": Employee.JornadaType.EXENTA_22,
                "jornada_hours": Decimal("44.00"),
                "contract_type": Employee.ContractType.INDEFINIDO,
                "trabajo_pesado": False,
                "asignacion_familiar": Employee.AsignacionFamiliarTramo.TRAMO_D,
                "cargas_familiares": 0,
                "colacion": Decimal("50000"),
                "movilizacion": Decimal("40000"),
            },
            {
                "tax_id": f"66666666-{compute_rut_dv('66666666')}",
                "position": "Diseñador Gráfico",
                "department": "Diseño",
                "base_salary": Decimal("540000"),
                "afp_name": "Modelo",
                "salud_type": Employee.SaludType.FONASA,
                "jornada_type": Employee.JornadaType.ORDINARIA_22,
                "jornada_hours": Decimal("44.00"),
                "contract_type": Employee.ContractType.INDEFINIDO,
                "trabajo_pesado": False,
                "asignacion_familiar": Employee.AsignacionFamiliarTramo.TRAMO_A,
                "cargas_familiares": 4,
                "colacion": Decimal("55000"),
                "movilizacion": Decimal("35000"),
            },
        ]

        created_employees = []
        for emp_data in employees_data:
            contact = Contact.objects.filter(tax_id=emp_data["tax_id"]).first()
            if not contact:
                continue
            afp = AFP.objects.filter(name=emp_data["afp_name"]).first()
            emp, created = Employee.objects.get_or_create(
                contact=contact,
                defaults={
                    "position": emp_data["position"],
                    "department": emp_data.get("department", ""),
                    "base_salary": emp_data["base_salary"],
                    "afp": afp,
                    "salud_type": emp_data["salud_type"],
                    "isapre_amount_uf": emp_data.get("isapre_amount_uf", Decimal("0")),
                    "jornada_type": emp_data["jornada_type"],
                    "jornada_hours": emp_data["jornada_hours"],
                    "contract_type": emp_data["contract_type"],
                    "trabajo_pesado": emp_data["trabajo_pesado"],
                    "asignacion_familiar": emp_data["asignacion_familiar"],
                    "cargas_familiares": emp_data["cargas_familiares"],
                    "start_date": date(2026, 1, 1),
                },
            )
            if created:
                colacion = PayrollConcept.objects.get(name="Asignación de Colación")
                movilidad = PayrollConcept.objects.get(name="Asignación de Movilización")
                EmployeeConceptAmount.objects.get_or_create(
                    employee=emp, concept=colacion, defaults={"amount": emp_data["colacion"]}
                )
                EmployeeConceptAmount.objects.get_or_create(
                    employee=emp, concept=movilidad, defaults={"amount": emp_data["movilizacion"]}
                )
                self.stdout.write(f"    ✓ Employee '{contact.name}' — {emp_data['position']} (${emp_data['base_salary']:,.0f})")
            created_employees.append(emp)

        # 5. Payrolls: solo mes actual (períodos anteriores deben cerrar en 0)
        bco_estado = TreasuryAccount.objects.get(code="BCO-ESTADO")

        from treasury.services import TreasuryService as _TS

        admin_contact = Contact.objects.filter(tax_id="11111111-1").first()
        current_payroll_year = timezone.now().year
        current_payroll_month = timezone.now().month
        _funding_amount = Decimal("30000000")
        if bco_estado.current_balance < _funding_amount:
            _TS.create_movement(
                amount=_funding_amount,
                movement_type=TreasuryMovement.Type.INBOUND,
                payment_method=TreasuryMovement.Method.TRANSFER,
                to_account=bco_estado,
                partner=admin_contact,
                justify_reason=TreasuryMovement.JustifyReason.CAPITAL_CONTRIBUTION,
                created_by=User.objects.filter(is_superuser=True).first(),
                date=timezone.localdate(),
                reference="Aporte de Capital — Nóminas Demo",
                notes=f"Aporte de ${_funding_amount:,.0f} para cubrir pagos de remuneraciones.",
            )
            bco_estado.refresh_from_db()
            self.stdout.write(
                f"    ✓ Aporte de capital ${_funding_amount:,.0f} → BCO-ESTADO "
                f"(saldo ahora: ${bco_estado.current_balance:,.0f})"
            )

        payroll_months = [(current_payroll_year, current_payroll_month)]
        payroll_count = 0
        payment_count = 0

        for emp in created_employees:
            for year, month in payroll_months:
                existing = Payroll.objects.filter(
                    employee=emp, period_year=year, period_month=month
                ).first()
                if existing:
                    continue

                try:
                    payroll = PayrollService.generate_proforma_payroll(
                        employee_id=emp.pk, year=year, month=month
                    )
                    post_payroll(payroll)
                    payroll_count += 1

                    PayrollPaymentService.pay_salary(
                        payroll,
                        treasury_account_id=bco_estado.pk,
                        payment_date=timezone.localdate(),
                        payment_method="TRANSFER",
                        notes="Pago remuneración demo",
                        created_by=User.objects.filter(is_superuser=True).first(),
                    )
                    PayrollPaymentService.pay_previred(
                        payroll,
                        treasury_account_id=bco_estado.pk,
                        payment_date=timezone.localdate(),
                        payment_method="TRANSFER",
                        notes="Pago previred demo",
                        created_by=User.objects.filter(is_superuser=True).first(),
                    )
                    payment_count += 2
                except Exception as e:
                    import traceback
                    self.stdout.write(self.style.ERROR(
                        f"    ✗ Payroll {emp.code} {year}/{month:02d}: {str(e)[:120]}"
                    ))
                    traceback.print_exc()

        self.stdout.write(
            f"    ✓ {len(created_employees)} empleados, "
            f"{payroll_count} nóminas posteadas (solo mes actual), {payment_count} pagos registrados"
        )

    def _initialize_workflow_settings(self):
        """Seeds the WorkflowSettings singleton and standard NotificationRules."""
        from workflow.models import NotificationRule, WorkflowSettings

        # 1. WorkflowSettings singleton
        ws, _ = WorkflowSettings.objects.update_or_create(
            pk=1,
            defaults={
                "f29_creation_day": 12,
                "f29_payment_day": 20,
                "period_close_day": 5,
                "low_margin_threshold_percent": Decimal("10.00"),
            },
        )
        self.stdout.write("    ✓ WorkflowSettings singleton initialized.")

        # 2. Standard Notification Rules
        manager_user = User.objects.filter(username="gerente").first()
        admin_user = User.objects.filter(username="admin").first()

        notification_rules = [
            {
                "notification_type": "POS_CREDIT_APPROVAL",
                "description": "Aprobación de crédito en POS",
                "notify_creator": True,
                "assigned_user": manager_user,
            },
            {
                "notification_type": "SUBSCRIPTION_OC_CREATED",
                "description": "Orden de compra automática por suscripción",
                "notify_creator": False,
                "assigned_user": manager_user,
            },
            {
                "notification_type": "LOW_STOCK_ALERT",
                "description": "Alerta de stock bajo",
                "notify_creator": False,
                "assigned_user": manager_user,
            },
            {
                "notification_type": "WORK_ORDER_APPROVAL",
                "description": "Aprobación de orden de trabajo",
                "notify_creator": True,
                "assigned_user": admin_user,
            },
            {
                "notification_type": "F29_CREATION_REMINDER",
                "description": "Recordatorio de creación de F29",
                "notify_creator": False,
                "assigned_user": admin_user,
            },
            {
                "notification_type": "PERIOD_CLOSE_REMINDER",
                "description": "Recordatorio de cierre de período contable",
                "notify_creator": False,
                "assigned_user": admin_user,
            },
        ]

        created_count = 0
        for rule_data in notification_rules:
            notification_type = rule_data.pop("notification_type")
            _, created = NotificationRule.objects.update_or_create(
                notification_type=notification_type, defaults=rule_data
            )
            if created:
                created_count += 1
            rule_data["notification_type"] = notification_type  # restore for logging

        self.stdout.write(
            f"    ✓ {len(notification_rules)} NotificationRules configured ({created_count} new)."
        )

    def _create_demo_budget(self, accounts):
        """Creates a realistic operational budget for the current year."""
        current_year = timezone.now().year

        budget, _ = Budget.objects.get_or_create(
            name=f"Presupuesto Operativo {current_year}",
            defaults={
                "start_date": timezone.localdate().replace(month=1, day=1),
                "end_date": timezone.localdate().replace(month=12, day=31),
                "description": "Presupuesto base para la operación de la imprenta.",
            },
        )

        # Budget targets (Monthly)
        # Revenue: 7.5M CLP monthly (~90M annual)
        # COGS: 3.5M CLP monthly (incl. materials)
        # OPEX Salaries: 1.5M CLP monthly
        # OPEX Rent/Admin: 1.0M CLP monthly
        # Target EBITDA: 1.5M CLP monthly

        targets = [
            # Revenue (4.1.01)
            {
                "account": Account.objects.get(code="4.1.01"),
                "monthly_amount": Decimal("7500000"),
                "label": "Ventas Proyectadas Imprenta",
            },
            # Cost of Sales (5.1.01)
            {
                "account": Account.objects.get(code="5.1.01"),
                "monthly_amount": Decimal("3500000"),
                "label": "Insumos y Materiales Proyectados",
            },
            # Salaries (5.2.01.01)
            {
                "account": Account.objects.get(code="5.2.01.01"),
                "monthly_amount": Decimal("1500000"),
                "label": "Planilla Mensual Proyectada",
            },
            # Rent (5.2.02)
            {
                "account": Account.objects.get(code="5.2.02"),
                "monthly_amount": Decimal("800000"),
                "label": "Arriendo Planta y Oficinas",
            },
            # General Expense (5.2.06) - Admin/Misc
            {
                "account": Account.objects.get(code="5.2.06"),
                "monthly_amount": Decimal("200000"),
                "label": "Gastos Varios Oficina",
            },
        ]

        total_items = 0
        for target in targets:
            for month in range(1, 13):
                # Add slight seasonal variation (+/- 10%)
                variation = Decimal(str(random.uniform(0.9, 1.1)))
                adjusted_amount = (target["monthly_amount"] * variation).quantize(Decimal("1"))

                BudgetItem.objects.update_or_create(
                    budget=budget,
                    account=target["account"],
                    year=current_year,
                    month=month,
                    defaults={
                        "amount": adjusted_amount,
                    },
                )
                total_items += 1

        self.stdout.write(
            f"    ✓ Budget '{budget.name}' created/updated with {total_items} monthly items."
        )

    def _close_past_periods(self, accounts):
        """Cierra todos los meses anteriores al actual en 0 (contable y fiscal).

        Sin ventas/compras en períodos anteriores, cada F29 queda en 0 y los
        períodos tributario/contable se cierran sin movimientos.
        """
        from tax.services import (
            AccountingPeriodService,
            F29CalculationService,
            F29PaymentService,
            TaxPeriodService,
        )

        admin = User.objects.filter(is_superuser=True).first()
        bco_estado = TreasuryAccount.objects.get(code="BCO-ESTADO")
        current_year = timezone.now().year
        current_month = timezone.now().month

        self.stdout.write(f"\n{'─' * 50}")
        self.stdout.write("  Closing past periods at 0 (F29 + Accounting)...")

        for month in range(1, current_month):
            self.stdout.write(f"\n  ── Periodo {month:02d}/{current_year} ──")

            # 1. Create/refresh F29 declaration (debe quedar en 0 sin actividad)
            try:
                declaration = F29CalculationService.create_or_update_declaration(
                    year=current_year, month=month,
                )
                self.stdout.write(
                    f"    ✓ F29 en 0: ventas=${declaration.sales_taxed:,.0f}, "
                    f"compras=${declaration.purchases_taxed:,.0f}, "
                    f"IVA por pagar=${declaration.vat_to_pay:,.0f}"
                )
            except Exception as e:
                self.stdout.write(self.style.WARNING(
                    f"    ⚠ F29 creación falló: {str(e)[:80]}"
                ))
                continue

            # 2. Register F29 (journal entry)
            if not declaration.is_registered:
                try:
                    F29CalculationService.register_declaration(
                        declaration_id=declaration.pk,
                        folio_number=f"SII-{current_year}-{month:02d}",
                    )
                    self.stdout.write(
                        f"    ✓ F29 registrado en 0 (folio: SII-{current_year}-{month:02d})"
                    )
                except Exception as e:
                    self.stdout.write(self.style.WARNING(
                        f"    ⚠ F29 registro falló: {str(e)[:80]}"
                    ))
                    continue

            # 3. Pay F29 if amount due > 0 (no debería ocurrir sin actividad)
            if declaration.total_amount_due > 0:
                already_paid = sum(
                    p.amount for p in declaration.payments.all() if p.status == "POSTED"
                )
                remaining = declaration.total_amount_due - already_paid
                if remaining > 0:
                    try:
                        from datetime import date as _date

                        F29PaymentService.register_payment(
                            declaration_id=declaration.pk,
                            payment_data={
                                "amount": remaining,
                                "treasury_account_id": bco_estado.pk,
                                "payment_date": _date(current_year, month, 28),
                                "payment_method": "TRANSFER",
                                "reference": f"Pago F29 {month:02d}/{current_year}",
                            },
                            user=admin,
                        )
                        self.stdout.write(
                            f"    ✓ F29 pagado: ${remaining:,.0f} vía Transferencia BCO-ESTADO"
                        )
                    except Exception as e:
                        self.stdout.write(self.style.WARNING(
                            f"    ⚠ F29 pago falló: {str(e)[:80]}"
                        ))
                else:
                    self.stdout.write("    ✓ F29 ya pagado completamente")
            else:
                self.stdout.write("    ✓ F29 sin saldo a pagar (0)")

            # 4. Close TaxPeriod
            try:
                TaxPeriodService.close_period(
                    year=current_year, month=month, user=admin,
                )
                self.stdout.write("    ✓ Período tributario cerrado en 0")
            except Exception as e:
                self.stdout.write(self.style.WARNING(
                    f"    ⚠ Cierre tributario falló: {str(e)[:80]}"
                ))
                continue

            # 5. Close AccountingPeriod
            try:
                AccountingPeriodService.close_period(
                    year=current_year, month=month, user=admin,
                )
                self.stdout.write("    ✓ Período contable cerrado en 0")
            except Exception as e:
                self.stdout.write(self.style.WARNING(
                    f"    ⚠ Cierre contable falló: {str(e)[:80]}"
                ))

        closed_count = max(current_month - 1, 0)
        self.stdout.write(
            f"\n  ✓ {closed_count} períodos cerrados en 0 ({current_year})"
        )
