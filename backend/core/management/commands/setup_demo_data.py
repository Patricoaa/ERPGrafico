from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from accounting.models import Account, AccountType, AccountingSettings, JournalEntry, JournalItem
from inventory.models import ProductCategory, Product, Warehouse, StockMove
from contacts.models import Contact
from sales.models import SaleOrder, SaleLine, SaleDelivery, SaleDeliveryLine
from purchasing.models import PurchaseOrder, PurchaseLine, PurchaseReceipt, PurchaseReceiptLine
from treasury.models import TreasuryAccount, Payment
from billing.models import Invoice

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
                self.stdout.write(self.style.ERROR(f'Error purging data: {str(e)}'))
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
        # 1. Delete transactional children first
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
        
        # 2. Delete parent orders
        PurchaseOrder.objects.all().delete()
        SaleOrder.objects.all().delete()
        
        # 3. Delete Stock Moves and Journal Entries
        StockMove.objects.all().delete()
        JournalEntry.objects.all().delete()
        # Items are deleted by Cascade
        
        # 4. Master Data
        Product.objects.all().delete()
        ProductCategory.objects.all().delete()
        Warehouse.objects.all().delete()
        
        Contact.objects.all().delete()
        TreasuryAccount.objects.all().delete()
        
        # 5. Configuration & Accounts
        AccountingSettings.objects.all().delete()
        Account.objects.all().delete()

    def _get_acc(self, code, name, account_type, parent=None, is_reconcilable=False):
        acc, _ = Account.objects.get_or_create(
            code=code,
            defaults={
                'name': name,
                'account_type': account_type,
                'parent': parent,
                'is_reconcilable': is_reconcilable
            }
        )
        return acc

    def _create_accounts(self):
        # 1. Root Accounts
        assets = self._get_acc("1", "ACTIVOS", AccountType.ASSET)
        liabilities = self._get_acc("2", "PASIVOS", AccountType.LIABILITY)
        equity = self._get_acc("3", "PATRIMONIO", AccountType.EQUITY)
        income = self._get_acc("4", "INGRESOS", AccountType.INCOME)
        expenses = self._get_acc("5", "GASTOS", AccountType.EXPENSE)

        # 1.1 Current Assets
        start_assets = self._get_acc("1.1", "Activos Corrientes", AccountType.ASSET, assets)
        
        # 1.1.01 Cash & Bank
        cash_grp = self._get_acc("1.1.01", "Efectivo y Equivalentes", AccountType.ASSET, start_assets)
        cash_box = self._get_acc("1.1.01.01", "Caja General", AccountType.ASSET, cash_grp, True)
        bank_main = self._get_acc("1.1.01.02", "Banco Principal", AccountType.ASSET, cash_grp, True)

        # 1.1.02 Receivables
        receivable_grp = self._get_acc("1.1.02", "Deudores Comerciales", AccountType.ASSET, start_assets)
        receivables = self._get_acc("1.1.02.01", "Clientes Nacionales", AccountType.ASSET, receivable_grp, True)

        # 1.1.03 Inventory
        inventory_grp = self._get_acc("1.1.03", "Inventarios", AccountType.ASSET, start_assets)
        stock_materials = self._get_acc("1.1.03.01", "Mercaderías", AccountType.ASSET, inventory_grp)
        stock_raw = self._get_acc("1.1.03.02", "Materias Primas", AccountType.ASSET, inventory_grp)
        
        # 1.1.04 Tax Assets
        tax_assets = self._get_acc("1.1.04", "Impuestos por Recuperar", AccountType.ASSET, start_assets)
        vat_credit = self._get_acc("1.1.04.01", "IVA Crédito Fiscal", AccountType.ASSET, tax_assets)

        # 1.1.05 Prepayments
        prepay_grp = self._get_acc("1.1.05", "Anticipos", AccountType.ASSET, start_assets)
        prepayments = self._get_acc("1.1.05.01", "Anticipos a Proveedores", AccountType.ASSET, prepay_grp, True)

        # 1.1.06 Interim Assets
        interim_asset_grp = self._get_acc("1.1.06", "Cuentas Puente Activos", AccountType.ASSET, start_assets)
        stock_output = self._get_acc("1.1.06.01", "Salida de Stock (Puente)", AccountType.ASSET, interim_asset_grp, True)

        # 2.1 Current Liabilities
        start_liabilities = self._get_acc("2.1", "Pasivos Corrientes", AccountType.LIABILITY, liabilities)
        
        # 2.1.01 Payables
        payable_grp = self._get_acc("2.1.01", "Cuentas por Pagar", AccountType.LIABILITY, start_liabilities)
        payables = self._get_acc("2.1.01.01", "Proveedores Nacionales", AccountType.LIABILITY, payable_grp, True)

        # 2.1.04 Customer Advances
        advance_grp = self._get_acc("2.1.04", "Anticipos de Clientes", AccountType.LIABILITY, start_liabilities)
        advances = self._get_acc("2.1.04.01", "Anticipos de Clientes", AccountType.LIABILITY, advance_grp, True)
        
        # 2.1.02 Stock Interim
        stock_interim_grp = self._get_acc("2.1.02", "Cuentas Puente Pasivos", AccountType.LIABILITY, start_liabilities)
        stock_input = self._get_acc("2.1.02.01", "Facturas Pendientes de Recepción", AccountType.LIABILITY, stock_interim_grp, True)
        
        # 2.1.03 Tax Liabilities
        tax_liabilities = self._get_acc("2.1.03", "Impuestos por Pagar", AccountType.LIABILITY, start_liabilities)
        vat_debit = self._get_acc("2.1.03.01", "IVA Débito Fiscal", AccountType.LIABILITY, tax_liabilities)

        # 3.1 Equity
        capital = self._get_acc("3.1.01", "Capital Social", AccountType.EQUITY, equity)
        res_acum = self._get_acc("3.1.02", "Resultados Acumulados", AccountType.EQUITY, equity)

        # 4.1 Income
        sales_grp = self._get_acc("4.1.01", "Ingresos de Explotación", AccountType.INCOME, income)
        sales_merch = self._get_acc("4.1.01.01", "Venta de Mercaderías", AccountType.INCOME, sales_grp)
        sales_service = self._get_acc("4.1.01.02", "Venta de Servicios", AccountType.INCOME, sales_grp)
        
        # 5.1 Expenses
        cost_grp = self._get_acc("5.1.01", "Costo de Ventas", AccountType.EXPENSE, expenses)
        cogs = self._get_acc("5.1.01.01", "Costo de Venta", AccountType.EXPENSE, cost_grp)
        
        expense_grp = self._get_acc("5.2.01", "Gastos de Administración", AccountType.EXPENSE, expenses)
        office_exp = self._get_acc("5.2.01.01", "Gastos de Oficina", AccountType.EXPENSE, expense_grp)

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
