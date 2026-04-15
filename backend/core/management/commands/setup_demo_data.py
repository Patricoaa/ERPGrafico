#docker compose exec backend python manage.py setup_demo_data --purge
# SYNC_TRIGGER_20260207_0251

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from django.contrib.auth.hashers import make_password
from decimal import Decimal
import random
from accounting.models import Account, AccountType, AccountingSettings, JournalEntry, JournalItem, Budget, BudgetItem, BSCategory, ISCategory
from accounting.services import AccountingService
from inventory.models import (
    ProductCategory, Product, Warehouse, StockMove, UoMCategory, UoM, 
    PricingRule, Subscription, ProductAttribute, ProductAttributeValue,
    CustomFieldTemplate, ProductCustomField
)
from contacts.models import Contact
from contacts.partner_models import PartnerTransaction, PartnerEquityStake
from sales.models import SaleOrder, SaleLine, SaleDelivery, SaleDeliveryLine, SaleReturn, SaleReturnLine, DraftCart
from purchasing.models import PurchaseOrder, PurchaseLine, PurchaseReceipt, PurchaseReceiptLine, PurchaseReturn, PurchaseReturnLine
from treasury.models import (
    TreasuryAccount, TreasuryMovement, BankStatement, BankStatementLine,
    ReconciliationMatch, ReconciliationRule,
    POSTerminal, POSSession, POSSessionAudit,
    Bank, PaymentMethod, TerminalBatch
)
from billing.models import Invoice, NoteWorkflow
from tax.models import TaxPeriod, AccountingPeriod, F29Declaration, F29Payment
from hr.models import GlobalHRSettings, AFP, PayrollConcept, Employee, EmployeeConceptAmount, Payroll, PayrollItem, Absence, SalaryAdvance, PayrollPayment
from production.models import BillOfMaterials, BillOfMaterialsLine, WorkOrder, ProductionConsumption, WorkOrderMaterial, WorkOrderHistory
from core.models import User, CompanySettings, Attachment
from workflow.models import Task, Notification, TaskAssignmentRule, WorkflowSettings, NotificationRule

class Command(BaseCommand):
    help = 'Seeds database with comprehensive graphic industry data using IFRS CoA'

    def add_arguments(self, parser):
        parser.add_argument(
            '--purge',
            action='store_true',
            help='Delete all existing business data before seeding',
        )
        parser.add_argument(
            '--no-demo-flows',
            action='store_true',
            help='Skip creation of demo Sale/Purchase orders and invoices',
        )
        parser.add_argument(
            '--only-infra',
            action='store_true',
            help='Seeds ONLY infrastructure (Users, Accounts, Treasury accounts). Forces --no-demo-flows',
        )

    def handle(self, *args, **options):
        # NOTE: No @transaction.atomic on the outer handle().
        # The purge phase runs each model deletion in its own savepoint via _safe_delete().
        # Wrapping the whole handle in one transaction would cause PostgreSQL to mark the
        # entire connection as aborted if any single savepoint fails, breaking all subsequent
        # deletions with "current transaction is aborted".
        if options['purge']:
            self.stdout.write(self.style.WARNING('Purging existing data...'))
            try:
                self._purge_data()
                self.stdout.write(self.style.SUCCESS('Data purged.'))
            except Exception as e:
                import traceback
                self.stdout.write(self.style.ERROR(f'Error purging data: {str(e)}'))
                self.stdout.write(traceback.format_exc())
                return

        # Wrap the seeding phase in its own atomic block so we get full rollback
        # if anything fails during data creation (separate from the purge phase above).
        with transaction.atomic():
            self.stdout.write('Populating IFRS Chart of Accounts...')
            result_msg = AccountingService.populate_ifrs_coa()
            self.stdout.write(f"  {result_msg}")

            self.stdout.write('Configuring Inventory Accounting Mappings...')
            self._configure_inventory_accounting()

            self.stdout.write('Creating Demo Users...')
            self._create_all_users()
            
            # Get references to key accounts for further seeding
            accounts = self._get_account_references()
            
            self.stdout.write('Creating Partners...')
            partners = self._create_partners(accounts)

            self.stdout.write('Creating Units of Measure...')
            uoms = self._create_uoms()

            self.stdout.write('Creating Inventory & Manufacturing Data...')
            inventory = self._create_inventory(accounts, uoms)

            self.stdout.write('Creating Subscriptions...')
            self._create_subscriptions(accounts, partners['suppliers'])

            # Add initial stock for all storable products first to calculate its value
            self.stdout.write('Adding Initial Stock...')
            total_stock_value = self._add_initial_stock(accounts, partners)

            self.stdout.write('Creating Opening Balance...')
            self._create_opening_balance(accounts, partners, total_stock_value)

            self.stdout.write('Creating Treasury Infrastructure...')
            self._create_treasury_infrastructure(accounts, partners)

            self.stdout.write('Creating Accounting & Tax Periods...')
            periods = self._create_periods()

            if not options['no_demo_flows'] and not options['only_infra']:
                self.stdout.write('Creating Sales & Purchasing Demo Flow...')
                self._create_sales_purchasing_demo(accounts, partners, inventory, periods)

            self.stdout.write('Initializing Company Settings...')
            self._initialize_company_settings()

            self.stdout.write('Seeding Chilean HR Data...')
            self._create_hr_demo_data(accounts)

            self.stdout.write('Initializing Workflow Settings...')
            self._initialize_workflow_settings()

            self.stdout.write('Creating Demo Budget...')
            self._create_demo_budget(accounts)

        self.stdout.write(self.style.SUCCESS('Successfully seeded demo data for Graphic Industry!'))

    def _configure_inventory_accounting(self):
        """
        The populate_ifrs_coa() service already configures ALL accounts comprehensively.
        This method just adds any additional demo-specific accounts or adjustments.
        """
        settings = AccountingSettings.get_solo()
        if not settings:
            self.stdout.write(self.style.WARNING("  ⚠ No AccountingSettings found. Skipping additional configuration."))
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
            'Receivable': settings.default_receivable_account,
            'Payable': settings.default_payable_account,
            'Revenue': settings.default_revenue_account,
            'Expense': settings.default_expense_account,
            'Inventory (Storable)': settings.storable_inventory_account,
            'Inventory (Manufacturable)': settings.manufacturable_inventory_account,
            'COGS (Merchandise)': settings.merchandise_cogs_account,
            'COGS (Manufactured)': settings.manufactured_cogs_account,
            'POS Cash Difference (Gain)': settings.pos_cash_difference_gain_account,
            'POS Cash Difference (Loss)': settings.pos_cash_difference_loss_account,
            'Terminal Commission Bridge': settings.terminal_commission_bridge_account,
            'Bank Commission': settings.bank_commission_account,
            'VAT Payable': settings.vat_payable_account,
            'Loan Retention': settings.loan_retention_account,
            'ILA Tax': settings.ila_tax_account,
            'VAT Withholding (CS)': settings.vat_withholding_account,
            
            # Inventory Adjustment Verification
            'Inv. Gain': settings.adjustment_income_account,
            'Inv. Loss': settings.adjustment_expense_account,
            'Revaluation': settings.revaluation_account,
            
            # Treasury Reconciliation Verification
            'Interest Income': settings.interest_income_account,
            'Exchange Diff': settings.exchange_difference_account,
            'Rounding Adj': settings.rounding_adjustment_account,
            'Error Adj': settings.error_adjustment_account,
            'Misc Adj': settings.miscellaneous_adjustment_account,
        }
        
        self.stdout.write("\n  📊 Key Account Mappings:")
        for name, account in key_mappings.items():
            if account:
                self.stdout.write(f"     • {name}: {account.code} - {account.name}")
            else:
                self.stdout.write(self.style.WARNING(f"     ⚠ {name}: NOT CONFIGURED"))


    def _purge_data(self):
        from django.db import connection
        from core.models import ActionLog
        
        def _safe_delete(model_class, name):
            self.stdout.write(f"  Purging {name} (Truncate)...")
            try:
                table_name = model_class._meta.db_table
                with connection.cursor() as cursor:
                    # RESTART IDENTITY resets the auto-increment sequences (PostgreSQL)
                    # CASCADE handles foreign key dependencies
                    cursor.execute(f'TRUNCATE TABLE "{table_name}" RESTART IDENTITY CASCADE;')
            except Exception as e:
                # Fallback for non-PostgreSQL or if TRUNCATE fails
                self.stdout.write(f"    - Truncate failed, falling back to delete() for {name}")
                try:
                    with transaction.atomic():
                        model_class.objects.all().delete()
                except Exception as e2:
                    error_str = str(e2).lower()
                    if "does not exist" in error_str:
                        return
                    self.stdout.write(self.style.ERROR(f"    Failed to delete {name}: {str(e2)}"))

        # 0. System & Logs
        _safe_delete(ActionLog, "ActionLog")
        _safe_delete(Attachment, "Attachment")

        # 1. Workflows & Transients
        _safe_delete(NoteWorkflow, "NoteWorkflow")
        _safe_delete(Subscription, "Subscription")
        _safe_delete(DraftCart, "DraftCart")
        _safe_delete(Task, "Task")
        _safe_delete(Notification, "Notification")
        _safe_delete(TaskAssignmentRule, "TaskAssignmentRule")
        _safe_delete(NotificationRule, "NotificationRule")

        # 2. Production
        _safe_delete(ProductionConsumption, "ProductionConsumption")
        _safe_delete(WorkOrderMaterial, "WorkOrderMaterial")
        _safe_delete(BillOfMaterialsLine, "BillOfMaterialsLine")
        _safe_delete(BillOfMaterials, "BillOfMaterials")
        _safe_delete(WorkOrderHistory, "WorkOrderHistory")
        _safe_delete(WorkOrder, "WorkOrder")

        # 3. Tax Module
        _safe_delete(F29Payment, "F29Payment")
        _safe_delete(F29Declaration, "F29Declaration")

        # 4. Logistics Detail
        _safe_delete(SaleReturnLine, "SaleReturnLine")
        _safe_delete(SaleDeliveryLine, "SaleDeliveryLine")
        _safe_delete(PurchaseReturnLine, "PurchaseReturnLine")
        _safe_delete(PurchaseReceiptLine, "PurchaseReceiptLine")

        # 5. Transactional Documents
        _safe_delete(SaleReturn, "SaleReturn")
        _safe_delete(SaleDelivery, "SaleDelivery")
        _safe_delete(PurchaseReturn, "PurchaseReturn")
        _safe_delete(PurchaseReceipt, "PurchaseReceipt")
        _safe_delete(Invoice, "Invoice")
        _safe_delete(TreasuryMovement, "TreasuryMovement")
        _safe_delete(StockMove, "StockMove")

        # 6. Orders
        _safe_delete(SaleLine, "SaleLine")
        _safe_delete(SaleOrder, "SaleOrder")
        _safe_delete(PurchaseLine, "PurchaseLine")
        _safe_delete(PurchaseOrder, "PurchaseOrder")

        # 7. POS & Infrastructure
        _safe_delete(POSSessionAudit, "POSSessionAudit")
        _safe_delete(POSSession, "POSSession")
        _safe_delete(POSTerminal, "POSTerminal")
        _safe_delete(TerminalBatch, "TerminalBatch")
        _safe_delete(PaymentMethod, "PaymentMethod")

        # 8. Banking
        _safe_delete(BankStatementLine, "BankStatementLine")
        _safe_delete(BankStatement, "BankStatement")
        _safe_delete(ReconciliationMatch, "ReconciliationMatch")
        _safe_delete(ReconciliationRule, "ReconciliationRule")
        _safe_delete(TreasuryAccount, "TreasuryAccount")
        _safe_delete(Bank, "Bank")

        # 9. Financial Core
        _safe_delete(JournalEntry, "JournalEntry")
        _safe_delete(BudgetItem, "BudgetItem")
        _safe_delete(Budget, "Budget")

        _safe_delete(ProductCustomField, "ProductCustomField")
        _safe_delete(CustomFieldTemplate, "CustomFieldTemplate")

        # 9.5 Partner Transactions
        _safe_delete(PartnerTransaction, "PartnerTransaction")

        # 9.6 HR Module — MUST be before Contact (Employee.contact is PROTECT)
        _safe_delete(PayrollItem, "PayrollItem")
        _safe_delete(PayrollPayment, "PayrollPayment")
        _safe_delete(Payroll, "Payroll")
        _safe_delete(Absence, "Absence")
        _safe_delete(SalaryAdvance, "SalaryAdvance")
        _safe_delete(EmployeeConceptAmount, "EmployeeConceptAmount")
        _safe_delete(Employee, "Employee")
        _safe_delete(PayrollConcept, "PayrollConcept")
        _safe_delete(AFP, "AFP")
        _safe_delete(GlobalHRSettings, "GlobalHRSettings")

        # 10. Master Data & Basics
        _safe_delete(PricingRule, "PricingRule")
        _safe_delete(ProductAttributeValue, "ProductAttributeValue")
        _safe_delete(ProductAttribute, "ProductAttribute")
        _safe_delete(Product, "Product")
        _safe_delete(ProductCategory, "ProductCategory")
        _safe_delete(Warehouse, "Warehouse")
        # Contact must come after Employee (Employee.contact is on_delete=PROTECT)
        _safe_delete(Contact, "Contact")
        _safe_delete(UoM, "UoM")
        _safe_delete(UoMCategory, "UoMCategory")
        _safe_delete(Account, "Account")
        _safe_delete(AccountingPeriod, "AccountingPeriod")
        _safe_delete(TaxPeriod, "TaxPeriod")

        # 11. Clear History (Comprehensive)
        self.stdout.write("  Clearing ALL Historical Records...")
        historical_models = [
            Employee, Payroll,
            Product, StockMove, SaleOrder, PurchaseOrder, Invoice, JournalEntry,
            Contact, Warehouse, ProductCategory, UoM, POSSession, TreasuryMovement,
            PartnerTransaction
        ]
        for model in historical_models:
            if hasattr(model, 'history'):
                try:
                    model.history.model.objects.all().delete()
                    self.stdout.write(f"    - {model.__name__} History cleared.")
                except Exception as e:
                    self.stdout.write(f"    - Could not clear {model.__name__} history: {str(e)}")

        self.stdout.write(self.style.SUCCESS("Purge completed successfully."))

    def _get_account_references(self):
        # We fetch accounts by code as defined in the modernize IFRS service
        return {
            'cash': Account.objects.get(code='1.1.01.01'),
            'bank': Account.objects.get(code='1.1.01.02'),
            'receivable': Account.objects.get(code='1.1.02.01'),
            'payable': Account.objects.get(code='2.1.01.01'),
            'inventory_raw': Account.objects.get(code='1.1.03.02'),
            'inventory_finished': Account.objects.get(code='1.1.03.01'),
            'vat_credit': Account.objects.get(code='1.1.04.01'),
            'vat_debit': Account.objects.get(code='2.1.02.01'),
            'capital': Account.objects.get(code='3.1.01'),
            'sales_product': Account.objects.get(code='4.1.01'),
            'sales_service': Account.objects.get(code='4.1.02'),
            'cogs_product': Account.objects.get(code='5.1.01'),
            'cogs_manufactured': Account.objects.get(code='5.1.02'), # NEW
            'cogs_service': Account.objects.get(code='5.1.03'), # Updated from 5.1.02
            'expense_general': Account.objects.get(code='5.2.06'),
            'expense_utilities': Account.objects.get(code='5.2.03'),
            'expense_rent': Account.objects.get(code='5.2.02'),
            'vat_carryforward': Account.objects.get(code='1.1.04.02'),
            'vat_payable': Account.objects.get(code='2.1.02.02'),
            'loan_retention': Account.objects.get(code='2.1.02.05'),
            'ila_tax': Account.objects.get(code='2.1.02.06'),
            'vat_withholding': Account.objects.get(code='2.1.02.07'),
            'correction_income': Account.objects.get(code='4.2.07'),
            'salary_payable': Account.objects.get(code='2.1.03.01'),
            'previred_payable': Account.objects.get(code='2.1.03.02'),
            'salary_advance': Account.objects.get(code='1.1.02.03'),
            'expense_salary': Account.objects.get(code='5.2.01.01'),
            'expense_prevision': Account.objects.get(code='5.2.01.02'),
        }

    def _create_partners(self, accounts):
        # 1. Default customer
        c_default, _ = Contact.objects.get_or_create(
            tax_id="66000000-0",
            defaults={
                'name': "Cliente Ocasional",
                'email': "contacto@clienteocasional.cl",
                'account_receivable': accounts['receivable'],
                'is_default_customer': True,
            }
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
                    'name': name,
                    'account_type': parent.account_type,
                    'parent': parent,
                    'is_reconcilable': True,
                    'bs_category': parent.bs_category, # Inherit BS category for reports
                    'is_category': parent.is_category,
                    'cf_category': parent.cf_category,
                }
            )
            return acc

        # Socio A: Administrador
        acc_cap_a = get_or_create_subaccount('3.1.01', "Socio A", "001")
        acc_earn_a = get_or_create_subaccount('3.2.01', "Socio A", "001")
        acc_recv_a = get_or_create_subaccount('1.1.05.01', "Socio A", "001")
        acc_div_a = get_or_create_subaccount('2.1.07', "Socio A", "001")
        
        socio_a, _ = Contact.objects.get_or_create(
            tax_id="11222333-4",
            defaults={
                'name': "Socio Administrador (Socio A)",
                'email': "socio.a@empresa.cl",
                'is_partner': True,
                'partner_contribution_account': acc_cap_a,
                'partner_earnings_account': acc_earn_a,
                'partner_receivable_account': acc_recv_a,
                'partner_dividends_payable_account': acc_div_a,
                'partner_equity_percentage': Decimal('50.00'),
            }
        )
        if not PartnerEquityStake.objects.filter(partner=socio_a).exists():
            PartnerEquityStake.objects.create(partner=socio_a, percentage=Decimal('50.00'), effective_from=timezone.now().date())

        # Socio B: Capitalista
        acc_cap_b = get_or_create_subaccount('3.1.01', "Socio B", "002")
        acc_earn_b = get_or_create_subaccount('3.2.01', "Socio B", "002")
        acc_recv_b = get_or_create_subaccount('1.1.05.01', "Socio B", "002")
        acc_div_b = get_or_create_subaccount('2.1.07', "Socio B", "002")
        
        socio_b, _ = Contact.objects.get_or_create(
            tax_id="22333444-5",
            defaults={
                'name': "Socio Capitalista (Socio B)",
                'email': "socio.b@empresa.cl",
                'is_partner': True,
                'partner_contribution_account': acc_cap_b,
                'partner_earnings_account': acc_earn_b,
                'partner_receivable_account': acc_recv_b,
                'partner_dividends_payable_account': acc_div_b,
                'partner_equity_percentage': Decimal('50.00'),
            }
        )
        if not PartnerEquityStake.objects.filter(partner=socio_b).exists():
            PartnerEquityStake.objects.create(partner=socio_b, percentage=Decimal('50.00'), effective_from=timezone.now().date())

        # 3. Regular Customers and Suppliers
        c1, _ = Contact.objects.get_or_create(tax_id="76111222-3", defaults={'name': "Editorial Amanecer S.A.", 'email': "contacto@amanecer.cl", 'account_receivable': accounts['receivable']})
        c2, _ = Contact.objects.get_or_create(tax_id="77333444-5", defaults={'name': "Publicidad Creativa Ltda", 'email': "ventas@pubcreativa.cl", 'account_receivable': accounts['receivable']})
        
        s1, _ = Contact.objects.get_or_create(tax_id="88222333-k", defaults={'name': "Distribuidora de Papeles S.A.", 'email': "pedidos@papelessa.cl", 'account_payable': accounts['payable']})
        s2, _ = Contact.objects.get_or_create(tax_id="99555666-0", defaults={'name': "Tintas Gráficas SpA", 'email': "tintas@graficas.cl", 'account_payable': accounts['payable']})
        s3, _ = Contact.objects.get_or_create(tax_id="76444555-8", defaults={'name': "Servicios Eléctricos Enel", 'email': "factura@enel.cl", 'account_payable': accounts['payable']})

        return {
            'default_customer': c_default,
            'owners': [socio_a, socio_b],
            'customers': [c1, c2],
            'suppliers': [s1, s2, s3]
        }

    def _create_uoms(self):
        cat_units, _ = UoMCategory.objects.get_or_create(name="Unidades")
        cat_weight, _ = UoMCategory.objects.get_or_create(name="Peso")
        cat_graphic, _ = UoMCategory.objects.get_or_create(name="Medidas Gráficas")
        
        # Basic
        uom_un, _ = UoM.objects.get_or_create(name="Unidad", defaults={'category': cat_units, 'ratio': 1.0, 'uom_type': UoM.Type.REFERENCE})
        uom_kg, _ = UoM.objects.get_or_create(name="Kilogramo (kg)", defaults={'category': cat_weight, 'ratio': 1.0, 'uom_type': UoM.Type.REFERENCE})
        
        # Graphic specifics
        uom_hoja, _ = UoM.objects.get_or_create(name="Hoja", defaults={'category': cat_graphic, 'ratio': 1.0, 'uom_type': UoM.Type.REFERENCE})
        uom_millar, _ = UoM.objects.get_or_create(name="Millar (1000u)", defaults={'category': cat_units, 'ratio': 1000.0, 'uom_type': UoM.Type.BIGGER})
        uom_resma, _ = UoM.objects.get_or_create(name="Resma (500 pl)", defaults={'category': cat_graphic, 'ratio': 500.0, 'uom_type': UoM.Type.BIGGER})
        uom_paquete, _ = UoM.objects.get_or_create(name="Paquete (100u)", defaults={'category': cat_units, 'ratio': 100.0, 'uom_type': UoM.Type.BIGGER})

        return {
            'un': uom_un,
            'kg': uom_kg,
            'hoja': uom_hoja,
            'millar': uom_millar,
            'resma': uom_resma,
            'paquete': uom_paquete
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
            
        return {
            'color': color,
            'material': material,
            'talla': talla
        }

    def _create_inventory(self, accounts, uoms):
        wh, _ = Warehouse.objects.get_or_create(code="WH-CITY", defaults={'name': "Bodega Taller Central"})

        cat_raw, _ = ProductCategory.objects.get_or_create(name="Materias Primas", defaults={'income_account': accounts['sales_product'], 'expense_account': accounts['cogs_product'], 'prefix': 'MP'})
        if cat_raw.asset_account: cat_raw.asset_account = None; cat_raw.save()
        
        cat_supplies, _ = ProductCategory.objects.get_or_create(name="Insumos", defaults={'income_account': accounts['sales_product'], 'expense_account': accounts['cogs_product'], 'prefix': 'INS'})
        if cat_supplies.asset_account: cat_supplies.asset_account = None; cat_supplies.save()
        
        cat_finished, _ = ProductCategory.objects.get_or_create(name="Productos Terminados", defaults={'income_account': accounts['sales_product'], 'expense_account': accounts['cogs_manufactured'], 'prefix': 'PT'})
        if cat_finished.asset_account: cat_finished.asset_account = None; cat_finished.save()
        
        cat_services, _ = ProductCategory.objects.get_or_create(name="Servicios Gráficos", defaults={'income_account': accounts['sales_service'], 'expense_account': accounts['cogs_service'], 'prefix': 'SRV'})
        if cat_services.asset_account: cat_services.asset_account = None; cat_services.save()

        # RAW MATERIALS - use skip_history=True during creation to avoid $0 history entry
        # The first meaningful history entry will come from _add_initial_stock when cost_price is set
        p_papel, _ = Product.objects.get_or_create(code="INS-0001", defaults={'name': "Resma de papel", 'category': cat_supplies, 'product_type': Product.Type.STORABLE, 'uom': uoms['resma'], 'purchase_uom': uoms['resma'], 'sale_price': 5000, 'receiving_warehouse': wh})
        if _: p_papel.skip_history_when_saving = True; p_papel.save(); del p_papel.skip_history_when_saving
        p_tinta_c, _ = Product.objects.get_or_create(code="MP-TIN-CYA", defaults={'name': "Tinta Offset Cyan 1kg", 'category': cat_raw, 'product_type': Product.Type.STORABLE, 'uom': uoms['kg'], 'purchase_uom': uoms['kg'], 'sale_price': 12000, 'receiving_warehouse': wh})
        p_tinta_m, _ = Product.objects.get_or_create(code="MP-TIN-MAG", defaults={'name': "Tinta Offset Magenta 1kg", 'category': cat_raw, 'product_type': Product.Type.STORABLE, 'uom': uoms['kg'], 'purchase_uom': uoms['kg'], 'sale_price': 12000, 'receiving_warehouse': wh})
        p_tinta_y, _ = Product.objects.get_or_create(code="MP-TIN-YEL", defaults={'name': "Tinta Offset Yellow 1kg", 'category': cat_raw, 'product_type': Product.Type.STORABLE, 'uom': uoms['kg'], 'purchase_uom': uoms['kg'], 'sale_price': 12000, 'receiving_warehouse': wh})
        p_tinta_k, _ = Product.objects.get_or_create(code="MP-TIN-BLA", defaults={'name': "Tinta Offset Black 1kg", 'category': cat_raw, 'product_type': Product.Type.STORABLE, 'uom': uoms['kg'], 'purchase_uom': uoms['kg'], 'sale_price': 10000, 'receiving_warehouse': wh})

        # FINISHED PRODUCTS (Fabricables)
        p_impresion_color, _ = Product.objects.get_or_create(code="PT-0001", defaults={
            'name': "Impresion a color", 
            'category': cat_finished, 
            'product_type': Product.Type.MANUFACTURABLE, 
            'uom': uoms['hoja'], 
            'sale_uom': uoms['hoja'],
            'sale_price': 150,
            'track_inventory': False,
            'mfg_enable_press': True,
            'mfg_enable_postpress': True,
            'mfg_auto_finalize': True
        })
        
        p_tarjetas, _ = Product.objects.get_or_create(code="PT-TAR-STAN", defaults={
            'name': "Tarjetas Personalizadas (Polimate)", 
            'category': cat_finished, 
            'product_type': Product.Type.MANUFACTURABLE, 
            'uom': uoms['un'], 
            'sale_uom': uoms['un'], 
            'sale_price': 150,
            'is_dynamic_pricing': True,
            'track_inventory': True,
            'receiving_warehouse': wh,
            'requires_advanced_manufacturing': True
        })
        
        # ---------------------------------------------------------
        # PRODUCT VARIANTS DEMO
        # ---------------------------------------------------------
        attrs = self._create_attributes()
        p_polera_base, _ = Product.objects.get_or_create(code="PT-POL-BASE", defaults={
            'name': "Polera Corporativa",
            'category': cat_finished,
            'product_type': Product.Type.MANUFACTURABLE,
            'uom': uoms['un'],
            'sale_price': 8500,
            'has_variants': True,
            'mfg_auto_finalize': True, # Express
            'requires_advanced_manufacturing': False
        })
        
        # Create some variants manually for the demo
        if p_polera_base:
            # Variant 1: Blanco - L
            v_blanco = ProductAttributeValue.objects.get(attribute=attrs['color'], value="Blanco")
            v_l = ProductAttributeValue.objects.get(attribute=attrs['talla'], value="L")
            
            p_blanco_l, _ = Product.objects.get_or_create(
                code="PT-POL-BLA-L",
                defaults={
                    'name': "Polera Corporativa",
                    'variant_display_name': "Polera Corporativa (Blanco, L)",
                    'category': cat_finished,
                    'product_type': Product.Type.MANUFACTURABLE,
                    'uom': uoms['un'],
                    'sale_price': 8500,
                    'parent_template': p_polera_base,
                    'mfg_auto_finalize': True,
                }
            )
            p_blanco_l.attribute_values.set([v_blanco, v_l])
            
            # Variant 2: Negro - XL
            v_negro = ProductAttributeValue.objects.get(attribute=attrs['color'], value="Negro")
            v_xl = ProductAttributeValue.objects.get(attribute=attrs['talla'], value="XL")
            
            p_negro_xl, _ = Product.objects.get_or_create(
                code="PT-POL-NEG-XL",
                defaults={
                    'name': "Polera Corporativa",
                    'variant_display_name': "Polera Corporativa (Negro, XL)",
                    'category': cat_finished,
                    'product_type': Product.Type.MANUFACTURABLE,
                    'uom': uoms['un'],
                    'sale_price': 9500, # Price override
                    'parent_template': p_polera_base,
                    'mfg_auto_finalize': True,
                }
            )
            p_negro_xl.attribute_values.set([v_negro, v_xl])

        # BOMs
        if not BillOfMaterials.objects.filter(product=p_impresion_color).exists():
            bom_impresion_color = BillOfMaterials.objects.create(product=p_impresion_color, name="BOM Impresion a color", active=True)
            # Para 1 impresion a color.
            BillOfMaterialsLine.objects.create(bom=bom_impresion_color, component=p_papel, quantity=Decimal('1'), uom=uoms['hoja'])

        # ---------------------------------------------------------
        # ADDITIONAL PRODUCTS LOOP (Increased Quantity)
        # ---------------------------------------------------------
        self.stdout.write('  Creating additional products...')
        extra_products = [
            ("Flyer Promocional A5", cat_finished, Product.Type.MANUFACTURABLE, 120, uoms['un']),
            ("Tríptico Corporativo", cat_finished, Product.Type.MANUFACTURABLE, 350, uoms['un']),
            ("Afiche Publicitario (Couché 170g)", cat_finished, Product.Type.MANUFACTURABLE, 1500, uoms['un']),
            ("Etiqueta Adhesiva Premium", cat_finished, Product.Type.MANUFACTURABLE, 80, uoms['un']),
            ("Carpeta Institucional", cat_finished, Product.Type.MANUFACTURABLE, 850, uoms['un']),
            ("Libreta de Notas (Bond 80g)", cat_finished, Product.Type.MANUFACTURABLE, 2500, uoms['un']),
            ("Sobre Americano Impreso", cat_finished, Product.Type.MANUFACTURABLE, 55, uoms['un']),
            ("Banner Roller Up (80x200cm)", cat_finished, Product.Type.MANUFACTURABLE, 35000, uoms['un']),
            ("Talonario de Facturas", cat_finished, Product.Type.MANUFACTURABLE, 4500, uoms['un']),
            ("Calendario de Escritorio", cat_finished, Product.Type.MANUFACTURABLE, 2800, uoms['un']),
            ("Papel Químico Duplicado", cat_raw, Product.Type.STORABLE, 15000, uoms['resma']),
            ("Cartulina Sulfatada 300g", cat_raw, Product.Type.STORABLE, 22000, uoms['paquete']),
            ("Barniz UV Brillo (L)", cat_supplies, Product.Type.STORABLE, 18500, uoms['un']),
            ("Alambre para Espiral", cat_supplies, Product.Type.STORABLE, 12000, uoms['kg']),
            ("Pegamento para Encuadernación", cat_supplies, Product.Type.STORABLE, 9500, uoms['un']),
            ("Plancha Offset GTO", cat_supplies, Product.Type.STORABLE, 4500, uoms['un']),
            ("Servicio Fotocopiado B/N", cat_services, Product.Type.SERVICE, 40, uoms['hoja']),
            ("Servicio Encuadernación", cat_services, Product.Type.SERVICE, 1500, uoms['un']),
            ("Servicio Plastificado A4", cat_services, Product.Type.SERVICE, 800, uoms['un']),
            ("Corte por Guillotina", cat_services, Product.Type.SERVICE, 500, uoms['un']),
        ]

        for i, (name, cat, type, price, uom) in enumerate(extra_products):
            # Mix some storable, manufacturable and services
            Product.objects.get_or_create(
                code=f"{cat.prefix}-{100 + i}",
                defaults={
                    'name': name,
                    'category': cat,
                    'product_type': type,
                    'uom': uom,
                    'sale_price': price,
                    'track_inventory': (type == Product.Type.STORABLE),
                    'receiving_warehouse': wh if type != Product.Type.SERVICE else None
                }
            )
        
        # SERVICES
        Product.objects.get_or_create(code="SRV-DIS-GRA", defaults={'name': "Servicio Diseño Gráfico", 'category': cat_services, 'product_type': Product.Type.SERVICE, 'uom': uoms['un'], 'sale_price': 25000})
        Product.objects.get_or_create(code="SRV-PRE-PRE", defaults={'name': "Pre-Prensa y Planchas", 'category': cat_services, 'product_type': Product.Type.SERVICE, 'uom': uoms['un'], 'sale_price': 15000})

        return {
            'warehouse': wh,
            'raw_materials': [p_papel, p_tinta_c, p_tinta_m, p_tinta_y, p_tinta_k]
        }

    def _create_subscriptions(self, accounts, suppliers):
        # Create Subscription Products
        # 1. Maintenance Category
        cat_maint, _ = ProductCategory.objects.get_or_create(
            name="Servicios de Mantenimiento", 
            defaults={
                'income_account': accounts['sales_service'], 
                'expense_account': accounts['expense_general'], 
                'prefix': 'MNT'
            }
        )

        p_maint_offset, _ = Product.objects.get_or_create(
            code="SUB-MNT-OFF",
            defaults={
                'name': "Mantención Preventiva Offset",
                'category': cat_maint,
                'product_type': Product.Type.SUBSCRIPTION,
                'uom': UoM.objects.get(name="Unidad"),
                'sale_price': 0, # Expense mostly
                'recurrence_period': Product.RecurrencePeriod.MONTHLY,
                'renewal_notice_days': 7,
                'can_be_sold': False,
                'can_be_purchased': True
            }
        )
        
        # 2. Utilities
        cat_utilities, _ = ProductCategory.objects.get_or_create(
            name="Servicios Básicos", 
            defaults={
                'income_account': accounts['sales_service'], 
                'expense_account': accounts['expense_utilities'], 
                'prefix': 'SB'
            }
        )

        p_electric, _ = Product.objects.get_or_create(
            code="SUB-ELEC",
            defaults={
                'name': "Suministro Eléctrico Taller",
                'category': cat_utilities,
                'product_type': Product.Type.SUBSCRIPTION,
                'uom': UoM.objects.get(name="Unidad"),
                'sale_price': 0,
                'recurrence_period': Product.RecurrencePeriod.MONTHLY,
                'is_variable_amount': True,
                'renewal_notice_days': 5,
                'can_be_sold': False,
                'can_be_purchased': True
            }
        )

        # Create Active Subscriptions
        
        # Contract for Machine maintenance
        # supplier[1] is Tintas Gráficas SpA (using as example provider)
        Subscription.objects.get_or_create(
            product=p_maint_offset,
            supplier=suppliers[1],
            defaults={
                'start_date': timezone.now().date(),
                'next_payment_date': timezone.now().date() + timezone.timedelta(days=5),
                'amount': 250000,
                'currency': "CLP",
                'status': Subscription.Status.ACTIVE,
                'recurrence_period': Product.RecurrencePeriod.MONTHLY,
                'notes': "Contrato anual de mantenimiento preventivo máquina Heidelberg."
            }
        )
        
        # Contract for Electricity (Variable)
        # supplier[2] is Servicios Eléctricos Enel
        Subscription.objects.get_or_create(
            product=p_electric,
            supplier=suppliers[2],
            defaults={
                'start_date': timezone.now().date(),
                'next_payment_date': timezone.now().date() + timezone.timedelta(days=20),
                'amount': 0, # Variable
                'currency': "CLP",
                'status': Subscription.Status.ACTIVE,
                'recurrence_period': Product.RecurrencePeriod.MONTHLY,
                'notes': "Suministro eléctrico principal. Monto varía según consumo."
            }
        )

    def _create_opening_balance(self, accounts, partners, total_stock_value=Decimal('0')):
        if JournalEntry.objects.filter(reference="OPEN-2026").exists():
            return
            
        entry = JournalEntry(
            date=timezone.now().date(),
            description="Asiento de Apertura 2026 (Suscripción y Pago de Capital)",
            reference="OPEN-2026",
            status=JournalEntry.State.POSTED,
        )
        entry._is_system_closing_entry = True
        entry.save()
        
        owners = partners.get('owners', [])
        num_owners = len(owners)
        
        if num_owners > 0:
            # 1. Suscripción de Capital (Subscription) = Initial Cash + Initial Stock Value
            total_bank = Decimal('50000000')
            total_subscription = total_bank + total_stock_value
            sub_per_owner = (total_subscription / num_owners).quantize(Decimal('1'))
            
            for owner in owners:
                owner_capital_account = owner.partner_contribution_account or accounts['capital']
                owner_recv_account = owner.partner_receivable_account or accounts['receivable']
                
                # Debit: Cuentas por Cobrar Socios
                JournalItem.objects.create(
                    entry=entry,
                    account=owner_recv_account,
                    debit=sub_per_owner,
                    credit=0,
                    label=f"Suscripción de Capital - {owner.name}",
                    partner=owner
                )
                # Credit: Capital Social
                JournalItem.objects.create(
                    entry=entry,
                    account=owner_capital_account,
                    debit=0,
                    credit=sub_per_owner,
                    label=f"Suscripción de Capital - {owner.name}",
                    partner=owner
                )
                
                PartnerTransaction.objects.create(
                    partner=owner,
                    transaction_type=PartnerTransaction.Type.EQUITY_SUBSCRIPTION,
                    amount=sub_per_owner,
                    date=timezone.now().date(),
                    description=f"Suscripción Inicial de Capital ({total_subscription:,.0f} total)",
                    journal_entry=entry,
                )
        
            # 2. Pago de Capital en Efectivo/Banco (Cash Contribution)
            JournalItem.objects.create(entry=entry, account=accounts['bank'], label="Ingreso Aporte Inicial Banco", debit=total_bank, credit=0)
            
            val_per_owner = (total_bank / num_owners).quantize(Decimal('1'))
            total_distributed = val_per_owner * num_owners
            diff = total_bank - total_distributed
            
            for i, owner in enumerate(owners):
                owner_recv_account = owner.partner_receivable_account or accounts['receivable']
                val = val_per_owner
                if i == 0:
                    val += diff
                    
                # Credit: Cuentas por Cobrar Socios (reduces debt)
                JournalItem.objects.create(
                    entry=entry,
                    account=owner_recv_account,
                    debit=0,
                    credit=val,
                    label=f"Pago Capital (Banco) - {owner.name}",
                    partner=owner
                )
                
                PartnerTransaction.objects.create(
                    partner=owner,
                    transaction_type=PartnerTransaction.Type.CAPITAL_CONTRIBUTION_CASH,
                    amount=val,
                    date=timezone.now().date(),
                    description="Pago de Capital en Efectivo (Depósito Bancario)",
                    journal_entry=entry,
                )
        else:
            total_bank = Decimal('50000000')
            JournalItem.objects.create(entry=entry, account=accounts['bank'], label="Ingreso Aporte Inicial", debit=total_bank, credit=0)
            JournalItem.objects.create(entry=entry, account=accounts['capital'], label="Capital Social Banco", debit=0, credit=total_bank)

    def _create_groups(self):
        """Creates standard functional groups (departments)."""
        from django.contrib.auth.models import Group
        
        groups = [
            'Supervisor',
            'Administración',
            'Bodega', 
            'Ventas', 
            'Diseño',
            'Pre-Prensa', 
            'Taller',
            'Terminaciones',
            'Despacho'
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
        
        # User definitions: (username, role, first_name, last_name, email)
        user_definitions = [
            ('admin', Roles.ADMIN, 'Admin', 'Sistema', 'admin@erpgrafico.com'),
            ('gerente', Roles.MANAGER, 'Gerente', 'General', 'gerente@erpgrafico.com'),
            ('operador', Roles.OPERATOR, 'Operador', 'Producción', 'operador@erpgrafico.com'),
            ('bodega', Roles.OPERATOR, 'Encargado', 'Bodega', 'bodega@erpgrafico.com'),
            ('ventas', Roles.OPERATOR, 'Ejecutivo', 'Ventas', 'ventas@erpgrafico.com'),
            ('diseno', Roles.OPERATOR, 'Diseñador', 'Gráfico', 'diseno@erpgrafico.com'), 
        ]

        for username, role_name, first, last, email in user_definitions:
            # Create system contact for the user
            contact, _ = Contact.objects.get_or_create(
                tax_id=f"USER-{username.upper()}",
                defaults={
                    'name': f"{first} {last}",
                    'email': email,
                    'contact_name': f"{first} {last}"
                }
            )

            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'email': email,
                    'first_name': first,
                    'last_name': last,
                    'contact': contact,
                    'is_staff': True,
                    'is_superuser': (role_name == Roles.ADMIN),
                    'pos_pin': make_password('1234')
                }
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
            if username == 'operador':
                user.groups.add(Group.objects.get(name='Taller'))
                user.groups.add(Group.objects.get(name='Terminaciones'))
            elif username == 'bodega':
                user.groups.add(Group.objects.get(name='Bodega'))
                user.groups.add(Group.objects.get(name='Despacho'))
            elif username == 'ventas':
                user.groups.add(Group.objects.get(name='Ventas'))
            elif username == 'diseno':
                user.groups.add(Group.objects.get(name='Diseño'))
                user.groups.add(Group.objects.get(name='Pre-Prensa'))
            elif username == 'gerente':
                user.groups.add(Group.objects.get(name='Administración'))
            elif username == 'admin':
                # Admin belongs to everyone for demo purposes
                for gname in ['Supervisor', 'Bodega', 'Ventas', 'Pre-Prensa', 'Taller', 'Terminaciones', 'Despacho', 'Diseño', 'Administración']:
                    user.groups.add(Group.objects.get(name=gname))

            # Set static password and PIN
            user.set_password('111111')
            user.pos_pin = make_password('1234')
            user.save()
            
            status = "created" if created else "updated"
            self.stdout.write(f"  User '{username}' {status} with password '111111' (Role: {role_name})")

    def _add_initial_stock(self, accounts, partners):
        """
        Creates initial inventory moves and accounting entries for all storable products.
        """
        warehouse = Warehouse.objects.first()
        if not warehouse:
            self.stdout.write(self.style.ERROR("  No warehouse found to add initial stock."))
            return

        settings = AccountingSettings.get_solo()
        initial_inv_account = accounts['capital']  # Use capital account directly (initial_inventory_account was removed)
        
        if not initial_inv_account:
            self.stdout.write(self.style.ERROR("  No initial inventory account found."))
            return

        entry = JournalEntry(
            date=timezone.now().date(),
            description="Carga Inicial de Inventario (Demo Data)",
            reference="INIT-STOCK",
            status=JournalEntry.State.POSTED,
        )
        entry._is_system_closing_entry = True
        entry.save()

        # Filter products that should receive initial stock
        # Exclude: advanced manufacturing, services, subscriptions, and express manufacturing
        products = Product.objects.filter(
            track_inventory=True
        ).exclude(
            requires_advanced_manufacturing=True
        ).exclude(
            product_type__in=[Product.Type.SERVICE, Product.Type.SUBSCRIPTION]
        ).exclude(
            mfg_auto_finalize=True  # Exclude express manufacturing products
        )
        
        total_value = Decimal('0')
        count = 0

        for product in products:
            # Random initial quantity between 50 and 500
            qty = Decimal(str(random.randint(50, 500)))
            
            # Determine a realistic cost based on sale price (approx 40-70% of sale price)
            if product.sale_price > 0:
                cost = (product.sale_price * Decimal(str(random.uniform(0.4, 0.7)))).quantize(Decimal('1'))
            else:
                # Default material costs
                cost = Decimal(str(random.randint(500, 5000)))

            # 1. Create Stock Move with unit_cost frozen at time of seeding
            move = StockMove(
                date=timezone.now().date(),
                product=product,
                warehouse=warehouse,
                quantity=qty,
                move_type=StockMove.Type.IN,
                description="Carga Inicial Demo Data",
                unit_cost=cost  # Frozen at creation - will not change
            )
            move._is_system_closing_entry = True
            move.save()

            # Update product cost PMP - single save with update_fields to track only cost change
            # First, remove the $0 history entry created on product creation (before cost was set)
            product.history.filter(cost_price=0).delete()
            product.cost_price = cost
            product.save(update_fields=['cost_price'])
            
            # 2. Create Journal Item (Debit Inventory)
            inv_account = product.get_asset_account or accounts['inventory_raw']
            line_val = qty * cost
            total_value += line_val

            JournalItem.objects.create(
                entry=entry,
                account=inv_account,
                debit=line_val,
                credit=0,
                label=f"Carga Inicial: {product.name}"
            )
            count += 1

        # 3. Create Balanced Equity Entry (Credit) - Split across partners
        if total_value > 0:
            owners = partners.get('owners', [])
            if owners:
                per_owner_value = (total_value / len(owners)).quantize(Decimal('1'))
                allocated_value = Decimal('0')
                
                for i, owner in enumerate(owners):
                    val = per_owner_value if i < len(owners) - 1 else total_value - allocated_value
                    allocated_value += val
                    
                    owner_recv_account = owner.partner_receivable_account or accounts['receivable']
                    
                    # Credit: Cuentas por Cobrar Socios (reduces debt)
                    JournalItem.objects.create(
                        entry=entry,
                        account=owner_recv_account,
                        debit=0,
                        credit=val,
                        label=f"Pago Capital (Inventario) - {owner.name}",
                        partner=owner
                    )
                    
                    PartnerTransaction.objects.create(
                        partner=owner,
                        transaction_type=PartnerTransaction.Type.CAPITAL_CONTRIBUTION_INVENTORY,
                        amount=val,
                        date=timezone.now().date(),
                        description="Pago de Capital en Especies (Inventario Inicial)",
                        journal_entry=entry,
                    )
            else:
                JournalItem.objects.create(
                    entry=entry,
                    account=initial_inv_account,
                    debit=0,
                    credit=total_value,
                    label="Contrapartida Carga Inicial Inventario"
                )

        self.stdout.write(f"  ✓ Initial stock added for {count} products. Total value: ${total_value:,.0f}")
        return total_value

    def _create_treasury_infrastructure(self, accounts, partners):
        self.stdout.write('  Creating POS Terminals and Treasury Physical Accounts...')
        
        manager_user = User.objects.get(username='gerente')
        
        # 0. Create Banks
        b_estado, _ = Bank.objects.get_or_create(code="ESTADO", defaults={'name': "Banco Estado", 'is_active': True})
        b_chile, _ = Bank.objects.get_or_create(code="CHILE", defaults={'name': "Banco de Chile", 'is_active': True})
        b_santander, _ = Bank.objects.get_or_create(code="SANTANDER", defaults={'name': "Banco Santander", 'is_active': True})
        b_bci, _ = Bank.objects.get_or_create(code="BCI", defaults={'name': "Banco BCI", 'is_active': True})

        # 1. Create Physical Treasury Accounts with UNIQUE Accounting Accounts
        
        # Helper to get/create specific cash account
        cash_parent = accounts['cash'].parent if accounts['cash'].parent else accounts['cash']
        
        def get_create_cash_account(code, name):
            acc, _ = Account.objects.get_or_create(
                code=code,
                defaults={
                    'name': name,
                    'account_type': AccountType.ASSET,
                    'parent': cash_parent,
                    'is_reconcilable': True,
                    'bs_category': BSCategory.CURRENT_ASSET # Explicitly for Liquidity Ratio
                }
            )
            return acc

        # Safe Account (1.1.01.01 - reusing main cash or creating specific)
        acc_safe = get_create_cash_account('1.1.01.11', "Efectivo Caja Fuerte")
        safe, _ = TreasuryAccount.objects.get_or_create(
            code="CAJA-FUERTE",
            defaults={
                'name': "Caja Fuerte Principal",
                'currency': "CLP",
                'account': acc_safe,
                'account_type': TreasuryAccount.Type.CASH,
                'allows_cash': True,
                'is_physical': True,
                'custodian': manager_user
            }
        )
        
        # Default Payment Method for Safe
        PaymentMethod.objects.get_or_create(
            name="Efectivo (Fuerte)",
            treasury_account=safe,
            defaults={
                'method_type': PaymentMethod.Type.CASH,
                'allow_for_sales': True,
                'allow_for_purchases': True
            }
        )

        # Till 1 Account
        acc_till1 = get_create_cash_account('1.1.01.12', "Efectivo Caja POS 01")
        till1, _ = TreasuryAccount.objects.get_or_create(
            code="CAJA-POS-01",
            defaults={
                'name': "Gaveta POS 01",
                'currency': "CLP",
                'account': acc_till1,
                'account_type': TreasuryAccount.Type.CASH,
                'allows_cash': True,
                'location': "Mostrador 1"
            }
        )
        
        # Default Payment Method for Till 1
        PaymentMethod.objects.get_or_create(
            name="Efectivo POS 01",
            treasury_account=till1,
            defaults={
                'method_type': PaymentMethod.Type.CASH,
                'allow_for_sales': True,
                'allow_for_purchases': True
            }
        )
        PaymentMethod.objects.get_or_create(
            name="Tarjeta Transbank POS 01",
            treasury_account=till1,
            defaults={
                'method_type': PaymentMethod.Type.CARD,
                'allow_for_sales': True,
                'allow_for_purchases': False, # POS usually only for sales
                'is_terminal': True,
                'supplier': partners['suppliers'][0],
                'terminal_receivable_account': accounts['receivable'],
                'commission_expense_account': accounts['expense_general']
            }
        )

        # Petty Cash Account
        acc_petty = get_create_cash_account('1.1.01.13', "Efectivo Caja Chica")
        petty, _ = TreasuryAccount.objects.get_or_create(
            code="CAJA-CHICA",
            defaults={
                'name': "Caja Chica Administración",
                'currency': "CLP",
                'account': acc_petty,
                'account_type': TreasuryAccount.Type.CASH,
                'allows_cash': True,
                'custodian': manager_user
            }
        )
        
        # Default Payment Method for Petty Cash
        PaymentMethod.objects.get_or_create(
            name="Efectivo Caja Chica",
            treasury_account=petty,
            defaults={
                'method_type': PaymentMethod.Type.CASH,
                'allow_for_sales': False,
                'allow_for_purchases': True
            }
        )
        
        # 1.1 New Additional Accounts
        bco01, _ = TreasuryAccount.objects.get_or_create(
            code="BCO-ESTADO",
            defaults={
                'name': "Banco Estado Empresa", 
                'currency': "CLP", 
                'account': accounts['bank'], 
                'account_type': TreasuryAccount.Type.CHECKING,
                'account_number': "123-45678-01",
                'allows_cash': False,
                'allows_card': True,
                'allows_transfer': True,
                'bank': b_estado
            }
        )
        
        # Payment Methods for Bank Account (Estado)
        pm_trans_est, _ = PaymentMethod.objects.get_or_create(
            name="Transferencia Estado",
            treasury_account=bco01,
            defaults={
                'method_type': PaymentMethod.Type.TRANSFER,
                'allow_for_sales': True,
                'allow_for_purchases': True
            }
        )

        # Workshop Till Account
        acc_workshop = get_create_cash_account('1.1.01.14', "Efectivo Caja Taller")
        caja01, _ = TreasuryAccount.objects.get_or_create(
            code="CAJA-TALLER",
            defaults={
                'name': "Caja Taller", 
                'currency': "CLP", 
                'account': acc_workshop, 
                'account_type': TreasuryAccount.Type.CASH,
                'allows_cash': True,
                'location': "Taller - Piso 2"
            }
        )
        
        # Payment Method for Workshop
        pm_efectivo_taller, _ = PaymentMethod.objects.get_or_create(
            name="Efectivo Taller",
            treasury_account=caja01,
            defaults={
                'method_type': PaymentMethod.Type.CASH,
                'allow_for_sales': True,
                'allow_for_purchases': True
            }
        )

        bank_chile, _ = TreasuryAccount.objects.get_or_create(
            code="BCO-CHILE",
            defaults={
                'name': "Banco de Chile (Cta Corriente)",
                'currency': "CLP",
                'account': Account.objects.get(code='1.1.01.03'),
                'account_type': TreasuryAccount.Type.CHECKING,
                'account_number': "987-65432-09",
                'allows_cash': False,
                'allows_card': True,
                'allows_transfer': True,
                'bank': b_chile
            }
        )

        # Payment Methods for Bank Account (Chile)
        PaymentMethod.objects.get_or_create(
            name="Transferencia Bco Chile",
            treasury_account=bank_chile,
            defaults={
                'method_type': PaymentMethod.Type.TRANSFER,
                'allow_for_sales': True,
                'allow_for_purchases': True
            }
        )

        # Reception Till Account
        acc_reception = get_create_cash_account('1.1.01.15', "Efectivo Caja Recepción")
        recepcion, _ = TreasuryAccount.objects.get_or_create(
            code="CAJA-REC",
            defaults={
                'name': "Caja Recepción Local",
                'currency': "CLP",
                'account': acc_reception,
                'account_type': TreasuryAccount.Type.CASH,
                'allows_cash': True,
                'location': "Recepción Principal"
            }
        )
        
        # Payment Methods for Reception
        PaymentMethod.objects.get_or_create(
            name="Efectivo Recepción",
            treasury_account=recepcion,
            defaults={
                'method_type': PaymentMethod.Type.CASH,
                'allow_for_sales': True,
                'allow_for_purchases': True
            }
        )
        pm_webpay, _ = PaymentMethod.objects.get_or_create(
            name="Webpay / Transbank",
            treasury_account=bco01,
            defaults={
                'method_type': PaymentMethod.Type.CARD,
                'allow_for_sales': True,
                'allow_for_purchases': False,
                'is_terminal': True,
                'supplier': partners['suppliers'][0],
                'terminal_receivable_account': accounts['receivable'],
                'commission_expense_account': Account.objects.get(code='5.2.13') # Use granular card commission account
            }
        )
        
        # 2. POS Terminals
        
        # POS-01: Caja Central P1
        t1, _ = POSTerminal.objects.get_or_create(
            code="POS-01",
            defaults={
                'name': "Caja Central P1",
                'location': "Planta 1 - Recepción",
                'ip_address': '192.168.1.100',
                'default_treasury_account': bco01 # Suggest bank account
            }
        )
        cash_pm_01 = PaymentMethod.objects.get(name="Efectivo POS 01")
        card_pm_01, _ = PaymentMethod.objects.get_or_create(
            name="Tarjeta Transbank POS 01",
            treasury_account=till1,
            defaults={
                'method_type': PaymentMethod.Type.CARD,
                'allow_for_sales': True,
                'allow_for_purchases': False,
                'is_terminal': True,
                'supplier': partners['suppliers'][0],
                'terminal_receivable_account': accounts['receivable'],
                'commission_expense_account': accounts['expense_general']
            }
        )
        # Association per screenshot: Efectivo POS 01 + Tarjeta Transbank POS 01
        t1.allowed_payment_methods.set([cash_pm_01, card_pm_01])

        # POS-02: Caja Taller P2
        t2, _ = POSTerminal.objects.get_or_create(
            code="POS-02",
            defaults={
                'name': "Caja Taller P2",
                'location': "Planta 2 - Taller",
                'ip_address': '192.168.1.100',
                'default_treasury_account': bco01
            }
        )
        # Association per screenshot: Efectivo Taller + Webpay / Transbank
        t2.allowed_payment_methods.set([pm_efectivo_taller, pm_webpay])

        # Ensure cashier user is linked to sessions correctly (Optional but good for demo)
        self.stdout.write("    ✓ Infrastructure created (Terminals, Safe, Tills, refined Payment Methods).")

    def _create_periods(self):
        """Creates tax and accounting periods for the current year."""
        current_year = timezone.now().year
        current_month = timezone.now().month
        periods = []
        # Create periods from January to current_month
        for month in range(1, current_month + 1):
            status = TaxPeriod.Status.OPEN
            if month < current_month:
                status = TaxPeriod.Status.CLOSED
            
            tax_period, _ = TaxPeriod.objects.get_or_create(
                year=current_year,
                month=month,
                defaults={'status': status}
            )
            
            acc_period, _ = AccountingPeriod.objects.get_or_create(
                year=current_year,
                month=month,
                defaults={'status': status, 'tax_period': tax_period}
            )
            
            # Close them if they are in the past
            if status == TaxPeriod.Status.CLOSED:
                tax_period.closed_at = timezone.now()
                tax_period.save()
                acc_period.closed_at = timezone.now()
                acc_period.save()
            
            periods.append({'tax': tax_period, 'acc': acc_period})
            
        self.stdout.write(f"    ✓ {len(periods)} periods created/verified for {current_year}.")
        return periods

    def _create_sales_purchasing_demo(self, accounts, partners, inventory, periods):
        """Creates a sample document flow for sales and purchasing."""
        from sales.services import SalesService
        from purchasing.services import PurchasingService
        from billing.models import Invoice
        
        # 1. SAMPLE SALE: NV -> GD -> FACT
        customer = partners['customers'][0]
        warehouse = inventory['warehouse']
        # Use a standard product to avoid manufacturing validation during seeding
        product = Product.objects.filter(product_type='STANDARD').first()
        
        if product:
            order = SaleOrder.objects.create(
                customer=customer,
                date=timezone.now().date(),
                payment_method=SaleOrder.PaymentMethod.CREDIT
            )
            SaleLine.objects.create(order=order, product=product, quantity=100, unit_price=150)
            order.save() # Triggers totals calculation
            
            # Confirm and Delivery
            SalesService.confirm_sale(order)
            delivery = SalesService.dispatch_order(order, warehouse)
            SalesService.confirm_delivery(delivery)
            
            # Bill
            invoice = Invoice.objects.create(
                dte_type=Invoice.DTEType.FACTURA,
                number="1001",
                sale_order=order,
                contact=customer,
                total_net=order.total_net,
                total_tax=order.total_tax,
                total=order.total,
                status=Invoice.Status.POSTED,
                date=timezone.now().date()
            )
            self.stdout.write(f"    ✓ Demo Sale Flow: FACT-{invoice.number} created.")

    def _initialize_company_settings(self):
        """
        Creates or updates the singleton CompanySettings and links it to 
        the internal company contact.
        """
        # Create/Get Internal Company Contact
        contact, created = Contact.objects.get_or_create(
            tax_id="76.000.000-0",
            defaults={
                'name': "Mi Empresa ERP",
                'email': "administracion@miempresa.cl",
                'phone': "+56 9 1234 5678",
                'address': "Av. Principal 123, Santiago, Chile",
            }
        )
        if created:
            self.stdout.write(f"  ✓ Created internal company contact: {contact.name}")

        # Initialize Company Settings
        settings, _ = CompanySettings.objects.update_or_create(
            id=1,  # Ensure it's the singleton
            defaults={
                'name': "Mi Empresa ERP",
                'tax_id': "76.000.000-0",
                'email': "administracion@miempresa.cl",
                'phone': "+56 9 1234 5678",
                'address': "Av. Principal 123, Santiago, Chile",
                'business_activity': "Servicios de Impresión y Diseño",
                'contact': contact,
                'primary_color': "#5b21b6", # purple-800
                'secondary_color': "#3b82f6", # blue-500
            }
        )
        self.stdout.write("  ✓ Initialized/Updated company settings singleton")

    def _create_hr_demo_data(self, accounts):
        """Seeds Chilean HR parameters, AFPs, and Concepts."""
        # 1. Global HR Settings
        hr_settings, _ = GlobalHRSettings.objects.get_or_create(
            id=1,
            defaults={
                'uf_current_value': Decimal('37000.00'),
                'utm_current_value': Decimal('65000.00'),
                'min_wage_value': Decimal('500000.00'),
                'account_remuneraciones_por_pagar': accounts['salary_payable'],
                'account_previred_por_pagar': accounts['previred_payable'],
                'account_anticipos': accounts['salary_advance'],
            }
        )
        self.stdout.write("    ✓ Global HR Settings initialized.")

        # 2. AFPs
        afps_data = [
            ('Habitat', Decimal('11.27')),
            ('Provida', Decimal('11.45')),
            ('Modelo', Decimal('10.58')),
        ]
        for name, pct in afps_data:
            AFP.objects.get_or_create(
                name=name,
                defaults={
                    'percentage': pct,
                    'account': accounts['previred_payable']
                }
            )
        self.stdout.write("    ✓ Standard AFPs created.")

        # 3. Payroll Concepts
        concepts_data = [
            # Haberes Imponibles
            {
                'name': 'Sueldo Base',
                'category': PayrollConcept.Category.HABER_IMPONIBLE,
                'account': accounts['expense_salary'],
                'formula_type': PayrollConcept.FormulaType.FIXED,
                'is_system': True
            },
            {
                'name': 'Gratificación Legal',
                'category': PayrollConcept.Category.HABER_IMPONIBLE,
                'account': accounts['expense_salary'],
                'formula_type': PayrollConcept.FormulaType.FORMULA,
                'formula': "min(IMPONIBLE * 0.25, (4.75 * MIN_WAGE) / 12)",
                'is_system': True
            },
            # Haberes No Imponibles
            {
                'name': 'Asignación de Colación',
                'category': PayrollConcept.Category.HABER_NO_IMPONIBLE,
                'account': Account.objects.get(code='5.2.18'),
                'formula_type': PayrollConcept.FormulaType.EMPLOYEE_SPECIFIC,
                'is_system': True
            },
            {
                'name': 'Asignación de Movilización',
                'category': PayrollConcept.Category.HABER_NO_IMPONIBLE,
                'account': Account.objects.get(code='5.2.18'),
                'formula_type': PayrollConcept.FormulaType.EMPLOYEE_SPECIFIC,
                'is_system': True
            },
            {
                'name': 'Seguro Cesantía (Aporte Trabajador)',
                'category': PayrollConcept.Category.DESCUENTO_LEGAL_TRABAJADOR,
                'account': accounts['previred_payable'],
                'formula_type': PayrollConcept.FormulaType.FORMULA,
                'formula': "IMPONIBLE * 0.006 if (CONTRATO_INDEFINIDO and CONTRACT_YEARS <= 11) else 0",
                'is_system': True
            },
            # Descuentos Legales (Empleador)
            {
                'name': 'AFP (Descuento)',
                'category': PayrollConcept.Category.DESCUENTO_LEGAL_TRABAJADOR,
                'account': accounts['previred_payable'],
                'formula_type': PayrollConcept.FormulaType.FORMULA,
                'formula': "IMPONIBLE * AFP_PERCENT",
                'is_system': True
            },
            {
                'name': 'Salud',
                'category': PayrollConcept.Category.DESCUENTO_LEGAL_TRABAJADOR,
                'account': accounts['previred_payable'],
                'formula_type': PayrollConcept.FormulaType.FORMULA,
                'formula': "max(IMPONIBLE * 0.07, ISAPRE_UF * UF)",
                'is_system': True
            },
            {
                'name': 'AFP (Aporte Empleador)',
                'category': PayrollConcept.Category.DESCUENTO_LEGAL_EMPLEADOR,
                'account': accounts['expense_prevision'],
                'formula_type': PayrollConcept.FormulaType.PERCENTAGE,
                'default_amount': Decimal('0.10'),
                'is_system': True
            },
            {
                'name': 'Seguro Social (Cotización expectativa de vida)',
                'category': PayrollConcept.Category.DESCUENTO_LEGAL_EMPLEADOR,
                'account': accounts['expense_prevision'],
                'formula_type': PayrollConcept.FormulaType.PERCENTAGE,
                'default_amount': Decimal('0.90'),
                'is_system': True
            },
            {
                'name': 'SIS (Seguro Invalidez)',
                'category': PayrollConcept.Category.DESCUENTO_LEGAL_EMPLEADOR,
                'account': accounts['expense_prevision'],
                'formula_type': PayrollConcept.FormulaType.PERCENTAGE,
                'default_amount': Decimal('1.54'),
                'is_system': True
            },
            {
                'name': 'Ley Accidente de trabajo',
                'category': PayrollConcept.Category.DESCUENTO_LEGAL_EMPLEADOR,
                'account': accounts['expense_prevision'],
                'formula_type': PayrollConcept.FormulaType.PERCENTAGE,
                'default_amount': Decimal('0.93'),
                'is_system': True
            },
            {
                'name': 'Seguro Cesantía (Aporte Empleador)',
                'category': PayrollConcept.Category.DESCUENTO_LEGAL_EMPLEADOR,
                'account': accounts['expense_prevision'],
                'formula_type': PayrollConcept.FormulaType.FORMULA,
                'formula': "IMPONIBLE * 0.008 if (CONTRATO_INDEFINIDO and CONTRACT_YEARS > 11) else (IMPONIBLE * 0.024 if CONTRATO_INDEFINIDO else IMPONIBLE * 0.03)",
                'is_system': True
            },
            # Otros
            {
                'name': 'Anticipo de Sueldo',
                'category': PayrollConcept.Category.OTRO_DESCUENTO,
                'account': accounts['salary_advance'],
                'formula_type': PayrollConcept.FormulaType.FIXED,
                'is_system': True
            },
        ]
        
        for data in concepts_data:
            name = data.pop('name')
            PayrollConcept.objects.update_or_create(
                name=name,
                defaults=data
            )
        self.stdout.write("    ✓ Payroll Concepts created.")

        # 4. Demo Employee
        admin_contact = Contact.objects.filter(tax_id='USER-ADMIN').first()
        if admin_contact:
            emp, created = Employee.objects.get_or_create(
                contact=admin_contact,
                defaults={
                    'position': 'Gerente de Operaciones',
                    'base_salary': Decimal('1200000'),
                    'afp': AFP.objects.filter(name='Habitat').first(),
                    'salud_type': Employee.SaludType.FONASA,
                    'start_date': timezone.now().date().replace(month=1, day=1),
                }
            )
            if created:
                # Add some specific amounts
                colacion = PayrollConcept.objects.get(name='Asignación de Colación')
                movilidad = PayrollConcept.objects.get(name='Asignación de Movilización')
                EmployeeConceptAmount.objects.create(employee=emp, concept=colacion, amount=Decimal('60000'))
                EmployeeConceptAmount.objects.create(employee=emp, concept=movilidad, amount=Decimal('40000'))
            self.stdout.write(f"    ✓ Demo Employee '{admin_contact.name}' created.")

    def _initialize_workflow_settings(self):
        """Seeds the WorkflowSettings singleton and standard NotificationRules."""
        from workflow.models import WorkflowSettings, NotificationRule

        # 1. WorkflowSettings singleton
        ws, _ = WorkflowSettings.objects.update_or_create(
            pk=1,
            defaults={
                'f29_creation_day': 12,
                'f29_payment_day': 20,
                'period_close_day': 5,
                'low_margin_threshold_percent': Decimal('10.00'),
            }
        )
        self.stdout.write("    ✓ WorkflowSettings singleton initialized.")

        # 2. Standard Notification Rules
        manager_user = User.objects.filter(username='gerente').first()
        admin_user = User.objects.filter(username='admin').first()

        notification_rules = [
            {
                'notification_type': 'POS_CREDIT_APPROVAL',
                'description': 'Aprobación de crédito en POS',
                'notify_creator': True,
                'assigned_user': manager_user,
            },
            {
                'notification_type': 'SUBSCRIPTION_OC_CREATED',
                'description': 'Orden de compra automática por suscripción',
                'notify_creator': False,
                'assigned_user': manager_user,
            },
            {
                'notification_type': 'LOW_STOCK_ALERT',
                'description': 'Alerta de stock bajo',
                'notify_creator': False,
                'assigned_user': manager_user,
            },
            {
                'notification_type': 'WORK_ORDER_APPROVAL',
                'description': 'Aprobación de orden de trabajo',
                'notify_creator': True,
                'assigned_user': admin_user,
            },
            {
                'notification_type': 'F29_CREATION_REMINDER',
                'description': 'Recordatorio de creación de F29',
                'notify_creator': False,
                'assigned_user': admin_user,
            },
            {
                'notification_type': 'PERIOD_CLOSE_REMINDER',
                'description': 'Recordatorio de cierre de período contable',
                'notify_creator': False,
                'assigned_user': admin_user,
            },
        ]

        created_count = 0
        for rule_data in notification_rules:
            notification_type = rule_data.pop('notification_type')
            _, created = NotificationRule.objects.update_or_create(
                notification_type=notification_type,
                defaults=rule_data
            )
            if created:
                created_count += 1
            rule_data['notification_type'] = notification_type  # restore for logging

        self.stdout.write(f"    ✓ {len(notification_rules)} NotificationRules configured ({created_count} new).")

    def _create_demo_budget(self, accounts):
        """Creates a realistic operational budget for the current year."""
        current_year = timezone.now().year
        
        budget, _ = Budget.objects.get_or_create(
            name=f"Presupuesto Operativo {current_year}",
            defaults={
                'start_date': timezone.now().date().replace(month=1, day=1),
                'end_date': timezone.now().date().replace(month=12, day=31),
                'description': "Presupuesto base para la operación de la imprenta.",
            }
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
                'account': Account.objects.get(code='4.1.01'),
                'monthly_amount': Decimal('7500000'),
                'label': "Ventas Proyectadas Imprenta"
            },
            # Cost of Sales (5.1.01)
            {
                'account': Account.objects.get(code='5.1.01'),
                'monthly_amount': Decimal('3500000'),
                'label': "Insumos y Materiales Proyectados"
            },
            # Salaries (5.2.01.01)
            {
                'account': Account.objects.get(code='5.2.01.01'),
                'monthly_amount': Decimal('1500000'),
                'label': "Planilla Mensual Proyectada"
            },
            # Rent (5.2.02)
            {
                'account': Account.objects.get(code='5.2.02'),
                'monthly_amount': Decimal('800000'),
                'label': "Arriendo Planta y Oficinas"
            },
            # General Expense (5.2.06) - Admin/Misc
            {
                'account': Account.objects.get(code='5.2.06'),
                'monthly_amount': Decimal('200000'),
                'label': "Gastos Varios Oficina"
            }
        ]

        total_items = 0
        for target in targets:
            for month in range(1, 13):
                # Add slight seasonal variation (+/- 10%)
                variation = Decimal(str(random.uniform(0.9, 1.1)))
                adjusted_amount = (target['monthly_amount'] * variation).quantize(Decimal('1'))
                
                BudgetItem.objects.update_or_create(
                    budget=budget,
                    account=target['account'],
                    year=current_year,
                    month=month,
                    defaults={
                        'amount': adjusted_amount,
                    }
                )
                total_items += 1

        self.stdout.write(f"    ✓ Budget '{budget.name}' created/updated with {total_items} monthly items.")
