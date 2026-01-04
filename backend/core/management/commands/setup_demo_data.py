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

    def _create_accounts(self):
        # 1. Root Accounts
        assets = Account.objects.create(code="1", name="ACTIVOS", account_type=AccountType.ASSET)
        liabilities = Account.objects.create(code="2", name="PASIVOS", account_type=AccountType.LIABILITY)
        equity = Account.objects.create(code="3", name="PATRIMONIO", account_type=AccountType.EQUITY)
        income = Account.objects.create(code="4", name="INGRESOS", account_type=AccountType.INCOME)
        expenses = Account.objects.create(code="5", name="GASTOS", account_type=AccountType.EXPENSE)

        # 1.1 Current Assets
        start_assets = Account.objects.create(code="1.1", name="Activos Corrientes", parent=assets, account_type=AccountType.ASSET)
        
        # 1.1.01 Cash & Bank
        cash_grp = Account.objects.create(code="1.1.01", name="Efectivo y Equivalentes", parent=start_assets, account_type=AccountType.ASSET)
        cash_box = Account.objects.create(code="1.1.01.01", name="Caja General", parent=cash_grp, account_type=AccountType.ASSET, is_reconcilable=True)
        bank_main = Account.objects.create(code="1.1.01.02", name="Banco Principal", parent=cash_grp, account_type=AccountType.ASSET, is_reconcilable=True)

        # 1.1.02 Receivables
        receivable_grp = Account.objects.create(code="1.1.02", name="Deudores Comerciales", parent=start_assets, account_type=AccountType.ASSET)
        receivables = Account.objects.create(code="1.1.02.01", name="Clientes Nacionales", parent=receivable_grp, account_type=AccountType.ASSET, is_reconcilable=True)

        # 1.1.03 Inventory
        inventory_grp = Account.objects.create(code="1.1.03", name="Inventarios", parent=start_assets, account_type=AccountType.ASSET)
        stock_materials = Account.objects.create(code="1.1.03.01", name="Mercaderías", parent=inventory_grp, account_type=AccountType.ASSET)
        stock_raw = Account.objects.create(code="1.1.03.02", name="Materias Primas", parent=inventory_grp, account_type=AccountType.ASSET)
        
        # 1.1.04 Tax Assets
        tax_assets = Account.objects.create(code="1.1.04", name="Impuestos por Recuperar", parent=start_assets, account_type=AccountType.ASSET)
        vat_credit = Account.objects.create(code="1.1.04.01", name="IVA Crédito Fiscal", parent=tax_assets, account_type=AccountType.ASSET)

        # 1.1.05 Prepayments
        prepay_grp = Account.objects.create(code="1.1.05", name="Anticipos", parent=start_assets, account_type=AccountType.ASSET)
        prepayments = Account.objects.create(code="1.1.05.01", name="Anticipos a Proveedores", parent=prepay_grp, account_type=AccountType.ASSET, is_reconcilable=True)

        # 2.1 Current Liabilities
        start_liabilities = Account.objects.create(code="2.1", name="Pasivos Corrientes", parent=liabilities, account_type=AccountType.LIABILITY)
        
        # 2.1.01 Payables
        payable_grp = Account.objects.create(code="2.1.01", name="Cuentas por Pagar", parent=start_liabilities, account_type=AccountType.LIABILITY)
        payables = Account.objects.create(code="2.1.01.01", name="Proveedores Nacionales", parent=payable_grp, account_type=AccountType.LIABILITY, is_reconcilable=True)

        # 2.1.04 Customer Advances
        advance_grp = Account.objects.create(code="2.1.04", name="Anticipos de Clientes", parent=start_liabilities, account_type=AccountType.LIABILITY)
        advances = Account.objects.create(code="2.1.04.01", name="Anticipos de Clientes", parent=advance_grp, account_type=AccountType.LIABILITY, is_reconcilable=True)
        
        # 2.1.02 Stock Interim (The Fix!)
        stock_interim_grp = Account.objects.create(code="2.1.02", name="Cuentas Puente Inventario", parent=start_liabilities, account_type=AccountType.LIABILITY)
        stock_input = Account.objects.create(code="2.1.02.01", name="Facturas Pendientes de Recepción", parent=stock_interim_grp, account_type=AccountType.LIABILITY, is_reconcilable=True)
        
        # 2.1.03 Tax Liabilities
        tax_liabilities = Account.objects.create(code="2.1.03", name="Impuestos por Pagar", parent=start_liabilities, account_type=AccountType.LIABILITY)
        vat_debit = Account.objects.create(code="2.1.03.01", name="IVA Débito Fiscal", parent=tax_liabilities, account_type=AccountType.LIABILITY)

        # 3.1 Equity
        capital = Account.objects.create(code="3.1.01", name="Capital Social", parent=equity, account_type=AccountType.EQUITY)
        results = Account.objects.create(code="3.1.02", name="Resultados Acumulados", parent=equity, account_type=AccountType.EQUITY)

        # 4.1 Income
        sales_grp = Account.objects.create(code="4.1.01", name="Ingresos de Explotación", parent=income, account_type=AccountType.INCOME)
        sales_merch = Account.objects.create(code="4.1.01.01", name="Venta de Mercaderías", parent=sales_grp, account_type=AccountType.INCOME)
        sales_service = Account.objects.create(code="4.1.01.02", name="Venta de Servicios", parent=sales_grp, account_type=AccountType.INCOME)
        
        # 5.1 Expenses
        cost_grp = Account.objects.create(code="5.1.01", name="Costo de Ventas", parent=expenses, account_type=AccountType.EXPENSE)
        cogs = Account.objects.create(code="5.1.01.01", name="Costo de Venta", parent=cost_grp, account_type=AccountType.EXPENSE)
        
        expense_grp = Account.objects.create(code="5.2.01", name="Gastos de Administración", parent=expenses, account_type=AccountType.EXPENSE)
        office_exp = Account.objects.create(code="5.2.01.01", name="Gastos de Oficina", parent=expense_grp, account_type=AccountType.EXPENSE)

        return {
            'cash': cash_box,
            'bank': bank_main,
            'capital': capital,
            'receivable': receivables,
            'payable': payables,
            'stock_merch': stock_materials,
            'stock_input': stock_input,
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
        
        # The specific cleanup fix
        settings.stock_input_account = accounts['stock_input']
        settings.default_prepayment_account = accounts['prepayments']
        settings.default_advance_payment_account = accounts['advances']
        
        settings.save()
        
        # Treasury Accounts
        TreasuryAccount.objects.create(name="Caja Chica", code="C01", currency="CLP", account=accounts['cash'], account_type=TreasuryAccount.Type.CASH)
        TreasuryAccount.objects.create(name="Banco Santander", code="B01", currency="CLP", account=accounts['bank'], account_type=TreasuryAccount.Type.BANK)

    def _create_partners(self, accounts):
        Contact.objects.create(name="Cliente Mostrador", tax_id="66666666-6", email="cliente@ejemplo.com", account_receivable=accounts['receivable'])
        Contact.objects.create(name="Proveedor Mayorista", tax_id="77777777-7", email="proveedor@ejemplo.com", account_payable=accounts['payable'])
        Contact.objects.create(name="Servicios Profesionales SpA", tax_id="88888888-8", email="servicios@ejemplo.com", account_payable=accounts['payable'])

    def _create_inventory(self, accounts):
        # Warehouse
        wh = Warehouse.objects.create(name="Bodega Central", code="WH-MAIN")

        # Categories
        cat_tech = ProductCategory.objects.create(
            name="Tecnología",
            asset_account=accounts['stock_merch'],
            income_account=accounts['sales'],
            expense_account=accounts['cogs']
        )
        
        # Products
        Product.objects.create(
            name="Notebook Gamer",
            code="DEV-001",
            category=cat_tech,
            sale_price=1500000,
            product_type=Product.Type.STORABLE
        )
        Product.objects.create(
            name="Mouse Óptico",
            code="PER-001",
            category=cat_tech,
            sale_price=15000,
            product_type=Product.Type.STORABLE
        )

    def _create_opening_balance(self, accounts):
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
