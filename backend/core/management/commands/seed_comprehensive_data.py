from django.core.management.base import BaseCommand
from django.db import transaction
from datetime import date, timedelta
from decimal import Decimal
import random

from accounting.models import (
    Account, AccountType, AccountingSettings, JournalEntry, JournalItem,
    Budget, BudgetItem, BSCategory, ISCategory, CFCategory
)
from inventory.models import ProductCategory, Product, Warehouse
from contacts.models import Contact
from treasury.models import TreasuryAccount

class Command(BaseCommand):
    help = 'Seeds comprehensive realistic business data for 2024-2025'

    def add_arguments(self, parser):
        parser.add_argument('--purge', action='store_true', help='Delete all existing data')

    @transaction.atomic
    def handle(self, *args, **options):
        if options['purge']:
            self.stdout.write(self.style.WARNING('Purging existing data...'))
            self._purge_data()
        
        self.stdout.write('Creating comprehensive 2024-2025 data...')
        accounts = self._create_coa()
        self._configure_settings(accounts)
        contacts = self._create_contacts(accounts)
        warehouses, products = self._create_inventory(accounts)
        
        # Generate 2024 data
        self.stdout.write(self.style.WARNING('Generating 2024 data...'))
        self._generate_year(2024, accounts, contacts, products)
        
        # Generate 2025 data
        self.stdout.write(self.style.WARNING('Generating 2025 data...'))
        self._generate_year(2025, accounts, contacts, products)
        
        self._create_budgets(accounts)
        self.stdout.write(self.style.SUCCESS('Successfully seeded data!'))

    def _purge_data(self):
        BudgetItem.objects.all().delete()
        Budget.objects.all().delete()
        JournalEntry.objects.all().delete()
        Product.objects.all().delete()
        ProductCategory.objects.all().delete()
        Warehouse.objects.all().delete()
        Contact.objects.all().delete()
        TreasuryAccount.objects.all().delete()
        AccountingSettings.objects.all().delete()
        Account.objects.all().delete()

    def _acc(self, code, name, typ, parent=None, recon=False, is_cat=None, cf_cat=None, bs_cat=None):
        acc, _ = Account.objects.update_or_create(
            code=code,
            defaults={
                'name': name, 'account_type': typ, 'parent': parent,
                'is_reconcilable': recon, 'is_category': is_cat,
                'cf_category': cf_cat, 'bs_category': bs_cat
            }
        )
        return acc

    def _create_coa(self):
        self.stdout.write('  Creating chart of accounts...')
        
        # Current Assets
        ca = self._acc('1.1', 'Activos Corrientes', AccountType.ASSET, bs_cat=BSCategory.CURRENT_ASSET)
        cash_grp = self._acc('1.1.01', 'Efectivo', AccountType.ASSET, ca, cf_cat=CFCategory.OPERATING)
        cash = self._acc('1.1.01.01', 'Caja', AccountType.ASSET, cash_grp, recon=True)
        bank = self._acc('1.1.01.02', 'Banco', AccountType.ASSET, cash_grp, recon=True)
        
        recv_grp = self._acc('1.1.02', 'Deudores', AccountType.ASSET, ca, cf_cat=CFCategory.OPERATING)
        receivables = self._acc('1.1.02.01', 'Clientes', AccountType.ASSET, recv_grp, recon=True)
        
        inv_grp = self._acc('1.1.03', 'Inventarios', AccountType.ASSET, ca, cf_cat=CFCategory.OPERATING)
        stock = self._acc('1.1.03.01', 'Productos', AccountType.ASSET, inv_grp)
        
        tax_grp = self._acc('1.1.04', 'Impuestos', AccountType.ASSET, ca)
        vat_credit = self._acc('1.1.04.01', 'IVA Credito', AccountType.ASSET, tax_grp)
        
        int_grp = self._acc('1.1.06', 'Cuentas Puente', AccountType.ASSET, ca)
        stock_out = self._acc('1.1.06.01', 'Salida Stock', AccountType.ASSET, int_grp, recon=True)
        
        # Non-Current Assets
        nca = self._acc('1.2', 'Activos No Corrientes', AccountType.ASSET, bs_cat=BSCategory.NON_CURRENT_ASSET)
        ppe_grp = self._acc('1.2.01', 'PPE', AccountType.ASSET, nca, cf_cat=CFCategory.INVESTING)
        machinery = self._acc('1.2.01.01', 'Maquinaria', AccountType.ASSET, ppe_grp)
        vehicles = self._acc('1.2.01.02', 'Vehiculos', AccountType.ASSET, ppe_grp)
        
        dep_grp = self._acc('1.2.02', 'Depreciacion', AccountType.ASSET, nca)
        dep_mach = self._acc('1.2.02.01', 'Dep Maquinaria', AccountType.ASSET, dep_grp)
        
        # Current Liabilities
        cl = self._acc('2.1', 'Pasivos Corrientes', AccountType.LIABILITY, bs_cat=BSCategory.CURRENT_LIABILITY)
        pay_grp = self._acc('2.1.01', 'Proveedores', AccountType.LIABILITY, cl, cf_cat=CFCategory.OPERATING)
        payables = self._acc('2.1.01.01', 'Proveedores', AccountType.LIABILITY, pay_grp, recon=True)
        
        int_liab = self._acc('2.1.02', 'Cuentas Puente', AccountType.LIABILITY, cl)
        stock_in = self._acc('2.1.02.01', 'Entrada Stock', AccountType.LIABILITY, int_liab, recon=True)
        
        tax_liab = self._acc('2.1.03', 'Impuestos', AccountType.LIABILITY, cl)
        vat_debit = self._acc('2.1.03.01', 'IVA Debito', AccountType.LIABILITY, tax_liab)
        
        # Equity
        eq = self._acc('3.1', 'Patrimonio', AccountType.EQUITY, bs_cat=BSCategory.EQUITY)
        capital = self._acc('3.1.01', 'Capital', AccountType.EQUITY, eq, cf_cat=CFCategory.FINANCING)
        retained = self._acc('3.1.02', 'Resultados', AccountType.EQUITY, eq)
        
        # Income
        rev = self._acc('4.1', 'Ingresos', AccountType.INCOME, is_cat=ISCategory.REVENUE, cf_cat=CFCategory.OPERATING)
        sales = self._acc('4.1.01', 'Ventas', AccountType.INCOME, rev)
        
        # Expenses
        cogs_grp = self._acc('5.1', 'Costo Ventas', AccountType.EXPENSE, is_cat=ISCategory.COST_OF_SALES, cf_cat=CFCategory.OPERATING)
        cogs = self._acc('5.1.01', 'Costo', AccountType.EXPENSE, cogs_grp)
        
        opex = self._acc('5.2', 'Gastos Operacionales', AccountType.EXPENSE, is_cat=ISCategory.OPERATING_EXPENSE, cf_cat=CFCategory.OPERATING)
        salaries = self._acc('5.2.01', 'Sueldos', AccountType.EXPENSE, opex)
        rent = self._acc('5.2.02', 'Arriendos', AccountType.EXPENSE, opex)
        utilities = self._acc('5.2.03', 'Servicios', AccountType.EXPENSE, opex)
        depreciation = self._acc('5.2.04', 'Depreciacion', AccountType.EXPENSE, opex, cf_cat=CFCategory.DEP_AMORT)
        
        return {
            'cash': cash, 'bank': bank, 'receivables': receivables, 'payables': payables,
            'stock': stock, 'stock_in': stock_in, 'stock_out': stock_out,
            'vat_credit': vat_credit, 'vat_debit': vat_debit,
            'machinery': machinery, 'vehicles': vehicles, 'dep_mach': dep_mach,
            'capital': capital, 'retained': retained,
            'sales': sales, 'cogs': cogs, 'salaries': salaries,
            'rent': rent, 'utilities': utilities, 'depreciation': depreciation
        }

    def _configure_settings(self, accounts):
        self.stdout.write('  Configuring settings...')
        settings, _ = AccountingSettings.objects.get_or_create(id=1)
        settings.default_receivable_account = accounts['receivables']
        settings.default_payable_account = accounts['payables']
        settings.default_revenue_account = accounts['sales']
        settings.default_expense_account = accounts['utilities']
        settings.default_tax_receivable_account = accounts['vat_credit']
        settings.default_tax_payable_account = accounts['vat_debit']
        settings.default_inventory_account = accounts['stock']
        settings.stock_input_account = accounts['stock_in']
        settings.stock_output_account = accounts['stock_out']
        settings.save()
        
        TreasuryAccount.objects.get_or_create(
            code='CASH01',
            defaults={'name': 'Caja', 'currency': 'CLP', 'account': accounts['cash'], 'account_type': TreasuryAccount.Type.CASH}
        )
        TreasuryAccount.objects.get_or_create(
            code='BANK01',
            defaults={'name': 'Banco', 'currency': 'CLP', 'account': accounts['bank'], 'account_type': TreasuryAccount.Type.BANK}
        )

    def _create_contacts(self, accounts):
        self.stdout.write('  Creating contacts...')
        customers = []
        for i in range(5):
            c, _ = Contact.objects.get_or_create(
                tax_id=f'7612345{i}-{i}',
                defaults={
                    'name': f'Cliente {i+1}',
                    'email': f'cliente{i+1}@example.com',
                    'account_receivable': accounts['receivables']
                }
            )
            customers.append(c)
        
        suppliers = []
        for i in range(3):
            s, _ = Contact.objects.get_or_create(
                tax_id=f'7645678{i}-{i}',
                defaults={
                    'name': f'Proveedor {i+1}',
                    'email': f'proveedor{i+1}@example.com',
                    'account_payable': accounts['payables']
                }
            )
            suppliers.append(s)
        
        return {'customers': customers, 'suppliers': suppliers}

    def _create_inventory(self, accounts):
        self.stdout.write('  Creating inventory...')
        wh, _ = Warehouse.objects.get_or_create(code='WH-01', defaults={'name': 'Bodega Principal'})
        
        cat, _ = ProductCategory.objects.get_or_create(
            name='General',
            defaults={
                'asset_account': accounts['stock'],
                'income_account': accounts['sales'],
                'expense_account': accounts['cogs']
            }
        )
        
        products = []
        for i in range(10):
            p, _ = Product.objects.get_or_create(
                code=f'PROD-{i+1:03d}',
                defaults={
                    'name': f'Product {i+1}',
                    'category': cat,
                    'sale_price': Decimal(str(150000 + i * 15000)),
                    'product_type': Product.Type.STORABLE
                }
            )
            products.append(p)
        
        return {'main': wh}, products

    def _generate_year(self, year, accounts, contacts, products):
        # Opening balance
        if year == 2024:
            self._create_opening(year, accounts)
        
        # Monthly data
        for month in range(1, 13):
            self.stdout.write(f'    Month {month}/12')
            self._create_monthly_expenses(year, month, accounts)
            self._create_depreciation(year, month, accounts)
            
            # Random sales (3-8 per month)
            for _ in range(random.randint(3, 8)):
                self._create_sale(year, month, accounts, contacts['customers'])
            
            # Random purchases (2-5 per month)
            for _ in range(random.randint(2, 5)):
                self._create_purchase(year, month, accounts, contacts['suppliers'])

    def _create_opening(self, year, accounts):
        entry = JournalEntry.objects.create(
            date=date(year, 1, 1),
            description=f'Apertura {year}',
            reference=f'OPEN-{year}',
            state=JournalEntry.State.POSTED
        )
        
        JournalItem.objects.create(entry=entry, account=accounts['bank'], debit=50000000, credit=0, label='Saldo inicial')
        JournalItem.objects.create(entry=entry, account=accounts['cash'], debit=2000000, credit=0, label='Saldo inicial')
        JournalItem.objects.create(entry=entry, account=accounts['machinery'], debit=80000000, credit=0, label='Maquinaria')
        JournalItem.objects.create(entry=entry, account=accounts['vehicles'], debit=35000000, credit=0, label='Vehiculos')
        JournalItem.objects.create(entry=entry, account=accounts['capital'], debit=0, credit=100000000, label='Capital')
        JournalItem.objects.create(entry=entry, account=accounts['retained'], debit=0, credit=67000000, label='Resultados')

    def _create_monthly_expenses(self, year, month, accounts):
        entry = JournalEntry.objects.create(
            date=date(year, month, 25),
            description=f'Gastos {month}/{year}',
            reference=f'OPEX-{year}-{month:02d}',
            state=JournalEntry.State.POSTED
        )
        
        JournalItem.objects.create(entry=entry, account=accounts['salaries'], debit=12000000, credit=0, label='Sueldos')
        JournalItem.objects.create(entry=entry, account=accounts['bank'], debit=0, credit=12000000, label='Pago')
        
        JournalItem.objects.create(entry=entry, account=accounts['rent'], debit=1500000, credit=0, label='Arriendo')
        JournalItem.objects.create(entry=entry, account=accounts['bank'], debit=0, credit=1500000, label='Pago')
        
        JournalItem.objects.create(entry=entry, account=accounts['utilities'], debit=450000, credit=0, label='Servicios')
        JournalItem.objects.create(entry=entry, account=accounts['bank'], debit=0, credit=450000, label='Pago')

    def _create_depreciation(self, year, month, accounts):
        entry = JournalEntry.objects.create(
            date=date(year, month, 28),
            description=f'Depreciacion {month}/{year}',
            reference=f'DEP-{year}-{month:02d}',
            state=JournalEntry.State.POSTED
        )
        
        JournalItem.objects.create(entry=entry, account=accounts['depreciation'], debit=666640, credit=0, label='Dep mensual')
        JournalItem.objects.create(entry=entry, account=accounts['dep_mach'], debit=0, credit=666640, label='Acumulada')

    def _create_sale(self, year, month, accounts, customers):
        day = random.randint(1, 28)
        amount = Decimal(str(random.randint(500000, 5000000)))
        customer = random.choice(customers)
        
        entry = JournalEntry.objects.create(
            date=date(year, month, day),
            description=f'Venta a {customer.name}',
            reference=f'VTA-{year}-{month:02d}-{day:02d}',
            state=JournalEntry.State.POSTED
        )
        
        vat = amount * Decimal('0.19')
        total = amount + vat
        cost = amount * Decimal('0.6')
        
        JournalItem.objects.create(entry=entry, account=accounts['receivables'], debit=total, credit=0, label='Cliente')
        JournalItem.objects.create(entry=entry, account=accounts['sales'], debit=0, credit=amount, label='Venta')
        JournalItem.objects.create(entry=entry, account=accounts['vat_debit'], debit=0, credit=vat, label='IVA')
        
        JournalItem.objects.create(entry=entry, account=accounts['cogs'], debit=cost, credit=0, label='Costo')
        JournalItem.objects.create(entry=entry, account=accounts['stock'], debit=0, credit=cost, label='Inventario')

    def _create_purchase(self, year, month, accounts, suppliers):
        day = random.randint(1, 28)
        amount = Decimal(str(random.randint(300000, 3000000)))
        supplier = random.choice(suppliers)
        
        entry = JournalEntry.objects.create(
            date=date(year, month, day),
            description=f'Compra a {supplier.name}',
            reference=f'CMP-{year}-{month:02d}-{day:02d}',
            state=JournalEntry.State.POSTED
        )
        
        vat = amount * Decimal('0.19')
        total = amount + vat
        
        JournalItem.objects.create(entry=entry, account=accounts['stock'], debit=amount, credit=0, label='Inventario')
        JournalItem.objects.create(entry=entry, account=accounts['vat_credit'], debit=vat, credit=0, label='IVA')
        JournalItem.objects.create(entry=entry, account=accounts['payables'], debit=0, credit=total, label='Proveedor')

    def _create_budgets(self, accounts):
        self.stdout.write('  Creating 2026 budget...')
        budget = Budget.objects.create(
            name='Presupuesto 2026',
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            description='Presupuesto proyectado'
        )
        
        for month in range(1, 13):
            BudgetItem.objects.create(budget=budget, account=accounts['sales'], month=month, amount=Decimal('15000000'))
            BudgetItem.objects.create(budget=budget, account=accounts['salaries'], month=month, amount=Decimal('12500000'))
            BudgetItem.objects.create(budget=budget, account=accounts['rent'], month=month, amount=Decimal('1500000'))
