from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from decimal import Decimal
import random

from accounting.models import Account, AccountType, AccountingSettings, JournalEntry, JournalItem, Budget, BudgetItem, BSCategory
from accounting.services import AccountingService
from inventory.models import ProductCategory, Product, Warehouse, StockMove, UoMCategory, UoM, PricingRule
from contacts.models import Contact
from sales.models import SaleOrder, SaleLine, SaleDelivery, SaleDeliveryLine
from purchasing.models import PurchaseOrder, PurchaseLine, PurchaseReceipt, PurchaseReceiptLine
from treasury.models import TreasuryAccount, Payment
from billing.models import Invoice
from services.models import ServiceCategory, ServiceContract, ServiceObligation
from production.models import BillOfMaterials, BillOfMaterialsLine, WorkOrder, ProductionConsumption

class Command(BaseCommand):
    help = 'Seeds database with comprehensive graphic industry data using IFRS CoA'

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

        self.stdout.write('Populating IFRS Chart of Accounts...')
        result_msg = AccountingService.populate_ifrs_coa()
        self.stdout.write(f"  {result_msg}")
        
        # Get references to key accounts for further seeding
        accounts = self._get_account_references()
        
        self.stdout.write('Creating Partners...')
        partners = self._create_partners(accounts)

        self.stdout.write('Creating Units of Measure...')
        uoms = self._create_uoms()

        self.stdout.write('Creating Inventory & Manufacturing Data...')
        inventory = self._create_inventory(accounts, uoms)

        self.stdout.write('Creating Service Contracts...')
        self._create_contracts(accounts, partners['suppliers'])

        self.stdout.write('Creating Opening Balance...')
        self._create_opening_balance(accounts)
        
        # Add initial stock for raw materials
        self.stdout.write('Adding Initial Stock...')
        self._create_initial_stock(inventory['warehouse'], inventory['raw_materials'])

        self.stdout.write(self.style.SUCCESS('Successfully seeded demo data for Graphic Industry!'))

    def _purge_data(self):
        def _safe_delete(model_class, name):
            self.stdout.write(f"  Deleting {name}...")
            try:
                model_class.objects.all().delete()
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"    Failed to delete {name}: {str(e)}"))
                raise e

        # Production child records
        _safe_delete(ProductionConsumption, "ProductionConsumption")
        _safe_delete(WorkOrder, "WorkOrder")
        _safe_delete(BillOfMaterialsLine, "BillOfMaterialsLine")
        _safe_delete(BillOfMaterials, "BillOfMaterials")

        # 1. Budgeting
        _safe_delete(BudgetItem, "BudgetItem")
        _safe_delete(Budget, "Budget")

        # 2. Services
        _safe_delete(ServiceObligation, "ServiceObligation")
        _safe_delete(ServiceContract, "ServiceContract")
        _safe_delete(ServiceCategory, "ServiceCategory")

        # 3. Transactional documents
        _safe_delete(Payment, "Payment")
        _safe_delete(Invoice, "Invoice")
        
        # Purchasing
        _safe_delete(PurchaseReceiptLine, "PurchaseReceiptLine")
        _safe_delete(PurchaseReceipt, "PurchaseReceipt")
        _safe_delete(PurchaseLine, "PurchaseLine")
        _safe_delete(PurchaseOrder, "PurchaseOrder")
        
        # Sales
        _safe_delete(SaleDeliveryLine, "SaleDeliveryLine")
        _safe_delete(SaleDelivery, "SaleDelivery")
        _safe_delete(SaleLine, "SaleLine")
        _safe_delete(SaleOrder, "SaleOrder")
        
        # 4. Inventory & Accounting
        _safe_delete(StockMove, "StockMove")
        _safe_delete(JournalEntry, "JournalEntry")
        
        # 5. Master Data
        _safe_delete(PricingRule, "PricingRule")
        _safe_delete(Product, "Product")
        _safe_delete(ProductCategory, "ProductCategory")
        _safe_delete(Warehouse, "Warehouse")
        _safe_delete(Contact, "Contact")
        
        # 6. Treasury & Configuration
        _safe_delete(TreasuryAccount, "TreasuryAccount")
        _safe_delete(AccountingSettings, "AccountingSettings")
        _safe_delete(UoM, "UoM")
        _safe_delete(UoMCategory, "UoMCategory")
        
        # 7. Accounts
        _safe_delete(Account, "Account")

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
            'cogs_service': Account.objects.get(code='5.1.02'),
            'expense_general': Account.objects.get(code='5.2.06'),
            'expense_utilities': Account.objects.get(code='5.2.03'),
            'expense_rent': Account.objects.get(code='5.2.02'),
        }

    def _create_partners(self, accounts):
        c1, _ = Contact.objects.get_or_create(tax_id="76111222-3", defaults={'name': "Editorial Amanecer S.A.", 'email': "contacto@amanecer.cl", 'account_receivable': accounts['receivable']})
        c2, _ = Contact.objects.get_or_create(tax_id="77333444-5", defaults={'name': "Publicidad Creativa Ltda", 'email': "ventas@pubcreativa.cl", 'account_receivable': accounts['receivable']})
        
        s1, _ = Contact.objects.get_or_create(tax_id="88222333-k", defaults={'name': "Distribuidora de Papeles S.A.", 'email': "pedidos@papelessa.cl", 'account_payable': accounts['payable']})
        s2, _ = Contact.objects.get_or_create(tax_id="99555666-0", defaults={'name': "Tintas Gráficas SpA", 'email': "tintas@graficas.cl", 'account_payable': accounts['payable']})
        s3, _ = Contact.objects.get_or_create(tax_id="76444555-8", defaults={'name': "Servicios Eléctricos Enel", 'email': "factura@enel.cl", 'account_payable': accounts['payable']})

        return {
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
        uom_pliego, _ = UoM.objects.get_or_create(name="Pliego", defaults={'category': cat_graphic, 'ratio': 1.0, 'uom_type': UoM.Type.REFERENCE})
        uom_millar, _ = UoM.objects.get_or_create(name="Millar (1000u)", defaults={'category': cat_units, 'ratio': 1000.0, 'uom_type': UoM.Type.BIGGER})
        uom_resma, _ = UoM.objects.get_or_create(name="Resma (500 pliegos)", defaults={'category': cat_graphic, 'ratio': 500.0, 'uom_type': UoM.Type.BIGGER})
        uom_paquete, _ = UoM.objects.get_or_create(name="Paquete (100u)", defaults={'category': cat_units, 'ratio': 100.0, 'uom_type': UoM.Type.BIGGER})

        return {
            'un': uom_un,
            'kg': uom_kg,
            'pliego': uom_pliego,
            'millar': uom_millar,
            'resma': uom_resma,
            'paquete': uom_paquete
        }

    def _create_inventory(self, accounts, uoms):
        wh, _ = Warehouse.objects.get_or_create(code="WH-CITY", defaults={'name': "Bodega Taller Central"})

        cat_raw, _ = ProductCategory.objects.get_or_create(name="Materias Primas", defaults={'asset_account': accounts['inventory_raw'], 'income_account': accounts['sales_product'], 'expense_account': accounts['cogs_product'], 'prefix': 'MP'})
        cat_supplies, _ = ProductCategory.objects.get_or_create(name="Insumos", defaults={'asset_account': accounts['inventory_raw'], 'income_account': accounts['sales_product'], 'expense_account': accounts['cogs_product'], 'prefix': 'INS'})
        cat_finished, _ = ProductCategory.objects.get_or_create(name="Productos Terminados", defaults={'asset_account': accounts['inventory_finished'], 'income_account': accounts['sales_product'], 'expense_account': accounts['cogs_product'], 'prefix': 'PT'})
        cat_services, _ = ProductCategory.objects.get_or_create(name="Servicios Gráficos", defaults={'asset_account': accounts['inventory_finished'], 'income_account': accounts['sales_service'], 'expense_account': accounts['cogs_service'], 'prefix': 'SRV'})

        # RAW MATERIALS
        p_papel, _ = Product.objects.get_or_create(code="MP-COU-170", defaults={'name': "Papel Couche 170g (Pliego 72x102)", 'category': cat_raw, 'product_type': Product.Type.STORABLE, 'uom': uoms['pliego'], 'purchase_uom': uoms['resma'], 'sale_price': 150})
        p_tinta_c, _ = Product.objects.get_or_create(code="MP-TIN-CYA", defaults={'name': "Tinta Offset Cyan 1kg", 'category': cat_raw, 'product_type': Product.Type.STORABLE, 'uom': uoms['kg'], 'purchase_uom': uoms['kg'], 'sale_price': 12000})
        p_tinta_m, _ = Product.objects.get_or_create(code="MP-TIN-MAG", defaults={'name': "Tinta Offset Magenta 1kg", 'category': cat_raw, 'product_type': Product.Type.STORABLE, 'uom': uoms['kg'], 'purchase_uom': uoms['kg'], 'sale_price': 12000})
        p_tinta_y, _ = Product.objects.get_or_create(code="MP-TIN-YEL", defaults={'name': "Tinta Offset Yellow 1kg", 'category': cat_raw, 'product_type': Product.Type.STORABLE, 'uom': uoms['kg'], 'purchase_uom': uoms['kg'], 'sale_price': 12000})
        p_tinta_k, _ = Product.objects.get_or_create(code="MP-TIN-BLA", defaults={'name': "Tinta Offset Black 1kg", 'category': cat_raw, 'product_type': Product.Type.STORABLE, 'uom': uoms['kg'], 'purchase_uom': uoms['kg'], 'sale_price': 10000})

        # FINISHED PRODUCTS (Fabricables)
        p_flyers, _ = Product.objects.get_or_create(code="PT-FLY-1015", defaults={
            'name': "Flyers 10x15cm (Couche 170g)", 
            'category': cat_finished, 
            'product_type': Product.Type.MANUFACTURABLE, 
            'uom': uoms['un'], 
            'sale_uom': uoms['millar'],
            'sale_price': 45000,
            'track_inventory': True,
            'mfg_enable_press': True,
            'mfg_enable_postpress': True
        })
        
        p_tarjetas, _ = Product.objects.get_or_create(code="PT-TAR-STAN", defaults={
            'name': "Tarjetas Personalizadas (Polimate)", 
            'category': cat_finished, 
            'product_type': Product.Type.MANUFACTURABLE, 
            'uom': uoms['un'], 
            'sale_uom': uoms['un'], 
            'sale_price': 150,
            'track_inventory': True
        })

        # BOMs
        if not BillOfMaterials.objects.filter(product=p_flyers).exists():
            bom_flyer = BillOfMaterials.objects.create(product=p_flyers, name="BOM Flyer Estándar 10x15", active=True)
            # Para 1 flyer 10x15, asumiendo 32 flyers por pliego (con merma)
            BillOfMaterialsLine.objects.create(bom=bom_flyer, component=p_papel, quantity=Decimal('0.03125'), uom=uoms['pliego'])
            BillOfMaterialsLine.objects.create(bom=bom_flyer, component=p_tinta_k, quantity=Decimal('0.0005'), uom=uoms['kg']) # Referencial
        
        # SERVICES
        Product.objects.get_or_create(code="SRV-DIS-GRA", defaults={'name': "Servicio Diseño Gráfico", 'category': cat_services, 'product_type': Product.Type.SERVICE, 'uom': uoms['un'], 'sale_price': 25000})
        Product.objects.get_or_create(code="SRV-PRE-PRE", defaults={'name': "Pre-Prensa y Planchas", 'category': cat_services, 'product_type': Product.Type.SERVICE, 'uom': uoms['un'], 'sale_price': 15000})

        # Treasury Accounts
        TreasuryAccount.objects.get_or_create(code="CAJA01", defaults={'name': "Caja Taller", 'currency': "CLP", 'account': accounts['cash'], 'account_type': TreasuryAccount.Type.CASH})
        TreasuryAccount.objects.get_or_create(code="BCO01", defaults={'name': "Banco Estado Empresa", 'currency': "CLP", 'account': accounts['bank'], 'account_type': TreasuryAccount.Type.BANK})

        return {
            'warehouse': wh,
            'raw_materials': [p_papel, p_tinta_c, p_tinta_m, p_tinta_y, p_tinta_k]
        }

    def _create_contracts(self, accounts, suppliers):
        cat_maint, _ = ServiceCategory.objects.get_or_create(code="MNT", defaults={'name': "Mantenimiento Máquinas", 'expense_account': accounts['expense_general'], 'payable_account': accounts['payable']})
        cat_rent, _ = ServiceCategory.objects.get_or_create(code="ARR", defaults={'name': "Arriendo de Local", 'expense_account': accounts['expense_rent'], 'payable_account': accounts['payable']})
        cat_utilities, _ = ServiceCategory.objects.get_or_create(code="SB", defaults={'name': "Servicios Básicos", 'expense_account': accounts['expense_utilities'], 'payable_account': accounts['payable']})
        
        # Contract for Machine maintenance
        ServiceContract.objects.get_or_create(
            name="Mantención Preventiva Offset",
            defaults={
                'supplier': suppliers[1], # Tintas/Servicios
                'category': cat_maint,
                'recurrence_type': ServiceContract.RecurrenceType.MONTHLY,
                'base_amount': 250000,
                'payment_day': 5,
                'start_date': timezone.now().date(),
                'status': ServiceContract.Status.ACTIVE
            }
        )
        
        # Contract for Electricity (Variable)
        ServiceContract.objects.get_or_create(
            name="Suministro Eléctrico Taller",
            defaults={
                'supplier': suppliers[2], # Enel
                'category': cat_utilities,
                'recurrence_type': ServiceContract.RecurrenceType.MONTHLY,
                'base_amount': 0,
                'is_amount_variable': True,
                'payment_day': 20,
                'start_date': timezone.now().date(),
                'status': ServiceContract.Status.ACTIVE
            }
        )

    def _create_opening_balance(self, accounts):
        if JournalEntry.objects.filter(reference="OPEN-2026").exists():
            return
            
        entry = JournalEntry.objects.create(
            date=timezone.now().date(),
            description="Asiento de Apertura 2026",
            reference="OPEN-2026",
            state=JournalEntry.State.POSTED,
        )
        
        # Initial Bank Capital
        JournalItem.objects.create(entry=entry, account=accounts['bank'], label="Aporte Inicial", debit=50000000, credit=0)
        JournalItem.objects.create(entry=entry, account=accounts['capital'], label="Capital Social", debit=0, credit=50000000)

    def _create_initial_stock(self, warehouse, products):
        for prod in products:
            if not StockMove.objects.filter(product=prod, warehouse=warehouse, description="SEED-STOCK").exists():
                StockMove.objects.create(
                    product=prod,
                    warehouse=warehouse,
                    quantity=500, # Start with 500 units/pliegos/kg
                    move_type=StockMove.Type.IN,
                    description="SEED-STOCK",
                    date=timezone.now().date()
                )
