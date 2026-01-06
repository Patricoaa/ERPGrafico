from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from accounting.models import Account, AccountType, AccountingSettings, JournalEntry, JournalItem, Budget, BudgetItem
from inventory.models import ProductCategory, Product, Warehouse, StockMove
from contacts.models import Contact
from sales.models import SaleOrder, SaleLine, SaleDelivery, SaleDeliveryLine
from purchasing.models import PurchaseOrder, PurchaseLine, PurchaseReceipt, PurchaseReceiptLine
from treasury.models import TreasuryAccount, Payment
from billing.models import Invoice
from services.models import ServiceCategory, ServiceContract, ServiceObligation

class Command(BaseCommand):
    help = 'Seeds database with coherent IFRS accounting data and sample products'

    def add_arguments(self, parser):
        parser.add_argument(
            '--purge',
            action='store_true',
            help='Delete all existing business data before seeding',
        )

    @transaction.atomic
    def handle(self, *args, **options):
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

        self.stdout.write('Creating Accounting Chart...')
        accounts = self._create_accounts()
        
        self.stdout.write('Configuring Settings...')
        self._configure_settings(accounts)
        
        self.stdout.write('Creating Partners...')
        partners = self._create_partners(accounts)

        self.stdout.write('Creating Inventory Data...')
        self._create_inventory(accounts)

        self.stdout.write('Creating Opening Balance...')
        self._create_opening_balance(accounts)

        self.stdout.write(self.style.SUCCESS('Successfully seeded demo data!'))

    def _purge_data(self):
        # 1. Budgeting (Child of Account)
        BudgetItem.objects.all().delete()
        Budget.objects.all().delete()

        # 2. Services (Linked to Contact and Account with PROTECT)
        ServiceObligation.objects.all().delete()
        ServiceContract.objects.all().delete()
        ServiceCategory.objects.all().delete()

        # 3. Transactional documents in correct order (Children first)
        Payment.objects.all().delete()
        Invoice.objects.all().delete()
        
        # Purchasing children
        PurchaseReceiptLine.objects.all().delete()
        PurchaseReceipt.objects.all().delete()
        PurchaseLine.objects.all().delete()
        
        # Sales children
        SaleDeliveryLine.objects.all().delete()
        SaleDelivery.objects.all().delete()
        SaleLine.objects.all().delete()
        
        # 4. Parent orders (linked to Contact/Warehouse with PROTECT)
        PurchaseOrder.objects.all().delete()
        SaleOrder.objects.all().delete()
        
        # 5. Inventory & Accounting Moves (links to Product/Account with PROTECT)
        StockMove.objects.all().delete()
        JournalEntry.objects.all().delete() # JournalItem are CASCADE from entry
        
        # 6. Master Data
        Product.objects.all().delete()
        ProductCategory.objects.all().delete()
        Warehouse.objects.all().delete()
        
        # 7. Contacts (often protected by Orders, now safe)
        Contact.objects.all().delete()
        
        # 8. Treasury & Configuration
        TreasuryAccount.objects.all().delete()
        AccountingSettings.objects.all().delete()
        
        # 9. Accounts (last, as everything else is gone)
        Account.objects.all().delete()

    def _get_acc(self, code, name, account_type, parent=None, is_reconcilable=False, is_category=None, cf_category=None):
        acc, _ = Account.objects.update_or_create(
            code=code,
            defaults={
                'name': name,
                'account_type': account_type,
                'parent': parent,
                'is_reconcilable': is_reconcilable,
                'is_category': is_category,
                'cf_category': cf_category,
            }
        )
        return acc

    def _create_accounts(self):
        # 0. Ensure Settings exist to get prefixes
        settings, _ = AccountingSettings.objects.get_or_create(id=1)

        # 1.1 Current Assets (Now Roots in DB)
        start_assets = self._get_acc(f"{settings.asset_prefix}.1", "Activos Corrientes", AccountType.ASSET, parent=None)
        
        # 1.1.01 Cash & Bank
        cash_grp = self._get_acc(f"{settings.asset_prefix}.1.01", "Efectivo y Equivalentes", AccountType.ASSET, start_assets)
        cash_box = self._get_acc(f"{settings.asset_prefix}.1.01.01", "Caja General", AccountType.ASSET, cash_grp, is_reconcilable=True, cf_category="OPERATING")
        bank_main = self._get_acc(f"{settings.asset_prefix}.1.01.02", "Banco Principal", AccountType.ASSET, cash_grp, is_reconcilable=True, cf_category="OPERATING")

        # 1.1.02 Receivables
        receivable_grp = self._get_acc(f"{settings.asset_prefix}.1.02", "Deudores Comerciales", AccountType.ASSET, start_assets)
        receivables = self._get_acc(f"{settings.asset_prefix}.1.02.01", "Clientes Nacionales", AccountType.ASSET, receivable_grp, is_reconcilable=True)

        # 1.1.03 Inventory
        inventory_grp = self._get_acc(f"{settings.asset_prefix}.1.03", "Inventarios", AccountType.ASSET, start_assets)
        stock_materials = self._get_acc(f"{settings.asset_prefix}.1.03.01", "Mercaderías", AccountType.ASSET, inventory_grp)
        stock_raw = self._get_acc(f"{settings.asset_prefix}.1.03.02", "Materias Primas", AccountType.ASSET, inventory_grp)
        
        # 1.1.04 Tax Assets
        tax_assets = self._get_acc(f"{settings.asset_prefix}.1.04", "Impuestos por Recuperar", AccountType.ASSET, start_assets)
        vat_credit = self._get_acc(f"{settings.asset_prefix}.1.04.01", "IVA Crédito Fiscal", AccountType.ASSET, tax_assets)

        # 1.1.05 Prepayments
        prepay_grp = self._get_acc(f"{settings.asset_prefix}.1.05", "Anticipos", AccountType.ASSET, start_assets)
        prepayments = self._get_acc(f"{settings.asset_prefix}.1.05.01", "Anticipos a Proveedores", AccountType.ASSET, prepay_grp, is_reconcilable=True)

        # 1.1.06 Interim Assets
        interim_asset_grp = self._get_acc(f"{settings.asset_prefix}.1.06", "Cuentas Puente Activos", AccountType.ASSET, start_assets)
        stock_output = self._get_acc(f"{settings.asset_prefix}.1.06.01", "Salida de Stock (Puente)", AccountType.ASSET, interim_asset_grp, is_reconcilable=True)

        # 2.1 Current Liabilities (Now Root in DB)
        start_liabilities = self._get_acc(f"{settings.liability_prefix}.1", "Pasivos Corrientes", AccountType.LIABILITY, parent=None)
        
        # 2.1.01 Payables
        payable_grp = self._get_acc(f"{settings.liability_prefix}.1.01", "Cuentas por Pagar", AccountType.LIABILITY, start_liabilities)
        payables = self._get_acc(f"{settings.liability_prefix}.1.01.01", "Proveedores Nacionales", AccountType.LIABILITY, payable_grp, is_reconcilable=True)

        # 2.1.04 Customer Advances
        advance_grp = self._get_acc(f"{settings.liability_prefix}.1.04", "Anticipos de Clientes", AccountType.LIABILITY, start_liabilities)
        advances = self._get_acc(f"{settings.liability_prefix}.1.04.01", "Anticipos de Clientes", AccountType.LIABILITY, advance_grp, is_reconcilable=True)
        
        # 2.1.02 Stock Interim
        stock_interim_grp = self._get_acc(f"{settings.liability_prefix}.1.02", "Cuentas Puente Pasivos", AccountType.LIABILITY, start_liabilities)
        stock_input = self._get_acc(f"{settings.liability_prefix}.1.02.01", "Facturas Pendientes de Recepción", AccountType.LIABILITY, stock_interim_grp, is_reconcilable=True)
        
        # 2.1.03 Tax Liabilities
        tax_liabilities = self._get_acc(f"{settings.liability_prefix}.1.03", "Impuestos por Pagar", AccountType.LIABILITY, start_liabilities)
        vat_debit = self._get_acc(f"{settings.liability_prefix}.1.03.01", "IVA Débito Fiscal", AccountType.LIABILITY, tax_liabilities)

        # 3.1 Equity (Now Root in DB)
        equity_root = self._get_acc(f"{settings.equity_prefix}.1", "Patrimonio Neto", AccountType.EQUITY, parent=None)
        capital = self._get_acc(f"{settings.equity_prefix}.1.01", "Capital Social", AccountType.EQUITY, equity_root)
        res_acum = self._get_acc(f"{settings.equity_prefix}.1.02", "Resultados Acumulados", AccountType.EQUITY, equity_root)

        # 4.1 Income (Now Root in DB)
        sales_grp = self._get_acc(f"{settings.income_prefix}.1.01", "Ingresos de Explotación", AccountType.INCOME, parent=None)
        sales_merch = self._get_acc(f"{settings.income_prefix}.1.01.01", "Venta de Mercaderías", AccountType.INCOME, sales_grp)
        sales_service = self._get_acc(f"{settings.income_prefix}.1.01.02", "Venta de Servicios", AccountType.INCOME, sales_grp)
        
        # 5.1 Expenses (Now Root in DB)
        cost_grp = self._get_acc(f"{settings.expense_prefix}.1.01", "Costo de Ventas", AccountType.EXPENSE, parent=None)
        cogs = self._get_acc(f"{settings.expense_prefix}.1.01.01", "Costo de Venta", AccountType.EXPENSE, cost_grp)
        
        expense_grp = self._get_acc(f"{settings.expense_prefix}.2.01", "Gastos de Administración", AccountType.EXPENSE, parent=None)
        office_exp = self._get_acc(f"{settings.expense_prefix}.2.01.01", "Gastos de Oficina", AccountType.EXPENSE, expense_grp, is_category="OPERATING_EXPENSE", cf_category="OPERATING")
        
        # Mapping for Income Statement sections
        sales_merch.is_category = "REVENUE"
        sales_merch.cf_category = "OPERATING"
        sales_merch.save()
        
        cogs.is_category = "COST_OF_SALES"
        cogs.cf_category = "OPERATING"
        cogs.save()

        capital.cf_category = "FINANCING"
        capital.save()

        receivables.cf_category = "OPERATING"
        receivables.save()
        
        payables.cf_category = "OPERATING"
        payables.save()
        
        stock_materials.cf_category = "OPERATING"
        stock_materials.save()

        return {
            'cash': cash_box,
            'bank': bank_main,
            'capital': capital,
            'receivable': receivables,
            'payable': payables,
            'stock_merch': stock_materials,
            'stock_input': stock_input,
            'stock_output': stock_output,
            'vat_credit': vat_credit,
            'vat_debit': vat_debit,
            'sales': sales_merch,
            'cogs': cogs,
            'office_exp': office_exp,
            'prepayments': prepayments,
            'advances': advances
        }

    def _configure_settings(self, accounts):
        settings, created = AccountingSettings.objects.get_or_create(id=1)
        settings.default_receivable_account = accounts['receivable']
        settings.default_payable_account = accounts['payable']
        settings.default_revenue_account = accounts['sales']
        settings.default_expense_account = accounts['office_exp']
        settings.default_tax_receivable_account = accounts['vat_credit']
        settings.default_tax_payable_account = accounts['vat_debit']
        settings.default_inventory_account = accounts['stock_merch']
        
        settings.stock_input_account = accounts['stock_input']
        settings.stock_output_account = accounts['stock_output']
        settings.default_prepayment_account = accounts['prepayments']
        settings.default_advance_payment_account = accounts['advances']
        
        settings.save()
        
        # Treasury Accounts
        TreasuryAccount.objects.get_or_create(code="C01", defaults={'name': "Caja Chica", 'currency': "CLP", 'account': accounts['cash'], 'account_type': TreasuryAccount.Type.CASH})
        TreasuryAccount.objects.get_or_create(code="B01", defaults={'name': "Banco Santander", 'currency': "CLP", 'account': accounts['bank'], 'account_type': TreasuryAccount.Type.BANK})

    def _create_partners(self, accounts):
        Contact.objects.get_or_create(tax_id="66666666-6", defaults={'name': "Cliente Mostrador", 'email': "cliente@ejemplo.com", 'account_receivable': accounts['receivable']})
        Contact.objects.get_or_create(tax_id="77777777-7", defaults={'name': "Proveedor Mayorista", 'email': "proveedor@ejemplo.com", 'account_payable': accounts['payable']})
        Contact.objects.get_or_create(tax_id="88888888-8", defaults={'name': "Servicios Profesionales SpA", 'email': "servicios@ejemplo.com", 'account_payable': accounts['payable']})

    def _create_inventory(self, accounts):
        # Warehouse
        wh, _ = Warehouse.objects.get_or_create(code="WH-MAIN", defaults={'name': "Bodega Central"})

        # Categories
        cat_tech, _ = ProductCategory.objects.get_or_create(
            name="Tecnología",
            defaults={
                'asset_account': accounts['stock_merch'],
                'income_account': accounts['sales'],
                'expense_account': accounts['cogs']
            }
        )
        
        # Products
        Product.objects.get_or_create(
            code="DEV-001",
            defaults={
                'name': "Notebook Gamer",
                'category': cat_tech,
                'sale_price': 1500000,
                'product_type': Product.Type.STORABLE
            }
        )
        Product.objects.get_or_create(
            code="PER-001",
            defaults={
                'name': "Mouse Óptico",
                'category': cat_tech,
                'sale_price': 15000,
                'product_type': Product.Type.STORABLE
            }
        )

    def _create_opening_balance(self, accounts):
        if JournalEntry.objects.filter(reference="APERTURA-001").exists():
            return
            
        entry = JournalEntry.objects.create(
            date=timezone.now().date(),
            description="Asiento de Apertura de Capital",
            reference="APERTURA-001",
            state=JournalEntry.State.POSTED,
        )
        
        # Debit: Bank
        JournalItem.objects.create(
            entry=entry,
            account=accounts['bank'],
            label="Aporte de Capital Inicial",
            debit=10000000,
            credit=0
        )
        
        # Credit: Capital
        JournalItem.objects.create(
            entry=entry,
            account=accounts['capital'],
            label="Aporte de Capital Inicial",
            debit=0,
            credit=10000000
        )
