#docker compose exec backend python manage.py setup_demo_data --purge
# SYNC_TRIGGER_20260207_0251

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from decimal import Decimal
import random
from accounting.models import Account, AccountType, AccountingSettings, JournalEntry, JournalItem, Budget, BudgetItem, BSCategory
from accounting.services import AccountingService
from inventory.models import (
    ProductCategory, Product, Warehouse, StockMove, UoMCategory, UoM, 
    PricingRule, Subscription, ProductAttribute, ProductAttributeValue
)
from contacts.models import Contact
from sales.models import SaleOrder, SaleLine, SaleDelivery, SaleDeliveryLine, SaleReturn, SaleReturnLine, DraftCart
from purchasing.models import PurchaseOrder, PurchaseLine, PurchaseReceipt, PurchaseReceiptLine, PurchaseReturn, PurchaseReturnLine
from treasury.models import (
    TreasuryAccount, TreasuryMovement, BankStatement, BankStatementLine,
    ReconciliationMatch, ReconciliationRule,
    CashDifference,
    POSTerminal, POSSession, POSSessionAudit,
    Bank, PaymentMethod, TerminalBatch
)
from billing.models import Invoice, NoteWorkflow
from tax.models import TaxPeriod, AccountingPeriod, F29Declaration, F29Payment
from production.models import BillOfMaterials, BillOfMaterialsLine, WorkOrder, ProductionConsumption, WorkOrderMaterial, WorkOrderHistory
from core.models import User
from workflow.models import Task, Notification, TaskAssignmentRule

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

        self.stdout.write('Creating Opening Balance...')
        self._create_opening_balance(accounts)
        
        # Add initial stock for all storable products
        self.stdout.write('Adding Initial Stock...')
        self._add_initial_stock(accounts)

        self.stdout.write('Creating Treasury Infrastructure...')
        self._create_treasury_infrastructure(accounts, partners)

        self.stdout.write('Creating Accounting & Tax Periods...')
        periods = self._create_periods()

        self.stdout.write('Creating Sales & Purchasing Demo Flow...')
        self._create_sales_purchasing_demo(accounts, partners, inventory, periods)

        self.stdout.write('Creating F29 Tax Declaration Demo...')
        self._create_tax_demo(periods)

        self.stdout.write(self.style.SUCCESS('Successfully seeded demo data for Graphic Industry!'))

    def _configure_inventory_accounting(self):
        """
        The populate_ifrs_coa() service already configures ALL accounts comprehensively.
        This method just adds any additional demo-specific accounts or adjustments.
        """
        settings = AccountingSettings.objects.first()
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
            
            # Inventory Adjustment Verification
            'Inv. Gain': settings.adjustment_income_account,
            'Inv. Loss': settings.adjustment_expense_account,
            'Initial Inv.': settings.initial_inventory_account,
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
        
        def _safe_delete(model_class, name):
            self.stdout.write(f"  Deleting {name}...")
            try:
                with transaction.atomic():
                    model_class.objects.all().delete()
            except Exception as e:
                # If the table doesn't exist, it's effectively "purged"
                error_str = str(e).lower()
                if "does not exist" in error_str or "unrecognized configuration parameter" in error_str:
                    self.stdout.write(f"    - Table for {name} does not exist, skipping.")
                    return
                self.stdout.write(self.style.ERROR(f"    Failed to delete {name}: {str(e)}"))
                # We don't raise here to allow the rest of the purge to continue
                # if we are in a fresh system state.

        # 1. Workflows & Transients
        _safe_delete(NoteWorkflow, "NoteWorkflow")
        _safe_delete(Subscription, "Subscription")
        _safe_delete(DraftCart, "DraftCart")
        _safe_delete(Task, "Task")
        _safe_delete(Notification, "Notification")
        _safe_delete(TaskAssignmentRule, "TaskAssignmentRule")

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
        _safe_delete(CashDifference, "CashDifference")
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
        
        # Reset AccountingSettings if possible (SET_NULL fields)
        try:
            settings = AccountingSettings.objects.first()
            if settings:
                # We don't delete settings, just clear protected-like refs if any
                # But mostly we delete Account in the next step which has SET_NULL in settings
                pass
        except:
            pass

        # 10. Master Data & Basics
        _safe_delete(PricingRule, "PricingRule")
        _safe_delete(ProductAttributeValue, "ProductAttributeValue")
        _safe_delete(ProductAttribute, "ProductAttribute")
        _safe_delete(Product, "Product")
        _safe_delete(ProductCategory, "ProductCategory")
        _safe_delete(Warehouse, "Warehouse")
        _safe_delete(Contact, "Contact")
        _safe_delete(UoM, "UoM")
        _safe_delete(UoMCategory, "UoMCategory")
        _safe_delete(Account, "Account")
        _safe_delete(AccountingPeriod, "AccountingPeriod")
        _safe_delete(TaxPeriod, "TaxPeriod")

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
            'correction_income': Account.objects.get(code='4.2.07'),
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

        # RAW MATERIALS
        p_papel, _ = Product.objects.get_or_create(code="INS-0001", defaults={'name': "Resma de papel", 'category': cat_supplies, 'product_type': Product.Type.STORABLE, 'uom': uoms['resma'], 'purchase_uom': uoms['resma'], 'sale_price': 5000, 'receiving_warehouse': wh})
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
                    'is_superuser': (role_name == Roles.ADMIN)
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

            # Set static password
            user.set_password('111111')
            user.save()
            
            status = "created" if created else "updated"
            self.stdout.write(f"  User '{username}' {status} with password '111111' (Role: {role_name})")

    def _add_initial_stock(self, accounts):
        """
        Creates initial inventory moves and accounting entries for all storable products.
        """
        warehouse = Warehouse.objects.first()
        if not warehouse:
            self.stdout.write(self.style.ERROR("  No warehouse found to add initial stock."))
            return

        settings = AccountingSettings.objects.first()
        initial_inv_account = settings.initial_inventory_account if settings else accounts['capital']
        
        if not initial_inv_account:
            self.stdout.write(self.style.ERROR("  No initial inventory account found."))
            return

        entry = JournalEntry.objects.create(
            date=timezone.now().date(),
            description="Carga Inicial de Inventario (Demo Data)",
            reference="INIT-STOCK",
            state=JournalEntry.State.POSTED,
        )

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

            # 1. Create Stock Move
            StockMove.objects.create(
                date=timezone.now().date(),
                product=product,
                warehouse=warehouse,
                quantity=qty,
                move_type=StockMove.Type.IN,
                description="Carga Inicial Demo Data"
            )

            # Update product cost PMP
            product.cost_price = cost
            product.save()

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

        # 3. Create Balanced Equity Entry (Credit)
        if total_value > 0:
            JournalItem.objects.create(
                entry=entry,
                account=initial_inv_account,
                debit=0,
                credit=total_value,
                label="Contrapartida Carga Inicial Inventario"
            )

        self.stdout.write(f"  ✓ Initial stock added for {count} products. Total value: ${total_value:,.0f}")

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
                    'account_type': AccountType.ASSET, # or LIQUIDITY
                    'parent': cash_parent,
                    'is_reconcilable': True
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
                'method_type': PaymentMethod.Type.CARD_TERMINAL,
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
        pm_deb_est, _ = PaymentMethod.objects.get_or_create(
            name="Tarjeta Débito Estado",
            treasury_account=bco01,
            defaults={
                'method_type': PaymentMethod.Type.DEBIT_CARD,
                'allow_for_sales': False,
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
        PaymentMethod.objects.get_or_create(
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
        PaymentMethod.objects.get_or_create(
            name="Cheque Bco Chile",
            treasury_account=bank_chile,
            defaults={
                'method_type': PaymentMethod.Type.CHECK,
                'allow_for_sales': True, # Allow for sales in POS
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
        PaymentMethod.objects.get_or_create(
            name="Webpay / Transbank",
            treasury_account=bco01,
            defaults={
                'method_type': PaymentMethod.Type.CARD_TERMINAL,
                'allow_for_sales': True,
                'allow_for_purchases': False,
                'is_terminal': True,
                'supplier': partners['suppliers'][0],
                'terminal_receivable_account': accounts['receivable'],
                'commission_expense_account': Account.objects.get(code='5.2.13') # Use granular card commission account
            }
        )
        
        # 2. POS Terminals
        t1, _ = POSTerminal.objects.get_or_create(
            code="POS-01",
            defaults={
                'name': "Caja Central P1",
                'location': "Planta 1 - Recepción",
                'default_treasury_account': bco01 # Point to Bank Account as requested
            }
        )
        # Assign allowed payment methods (Only 1 CASH method as requested + cards/transfers)
        cash_pm_01 = PaymentMethod.objects.get(name="Efectivo POS 01")
        other_methods = PaymentMethod.objects.filter(allow_for_sales=True).exclude(method_type=PaymentMethod.Type.CASH)
        t1.allowed_payment_methods.set([cash_pm_01] + list(other_methods))

        t2, _ = POSTerminal.objects.get_or_create(
            code="POS-02",
            defaults={
                'name': "Caja Taller P2",
                'location': "Planta 2 - Taller",
                'default_treasury_account': bco01 # Point to Bank Account as requested
            }
        )
        cash_pm_taller = PaymentMethod.objects.get(name="Efectivo Taller")
        t2.allowed_payment_methods.set([cash_pm_taller] + list(other_methods))

        # Ensure cashier user is linked to sessions correctly (Optional but good for demo)
        self.stdout.write("    ✓ Infrastructure created (Terminals, Safe, Tills, refined Payment Methods).")

    def _create_periods(self):
        """Creates tax and accounting periods for the current year."""
        current_year = timezone.now().year
        periods = []
        for month in range(1, 13):
            status = TaxPeriod.Status.OPEN
            if month < timezone.now().month:
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

        # 2. SAMPLE PURCHASE: OCS -> REC -> FCP
        supplier = partners['suppliers'][0]
        raw_mat = inventory['raw_materials'][0] # Resma de papel
        
        if raw_mat:
            p_order = PurchaseOrder.objects.create(
                supplier=supplier,
                date=timezone.now().date(),
                payment_method=PurchaseOrder.PaymentMethod.CREDIT
            )
            PurchaseLine.objects.create(order=p_order, product=raw_mat, quantity=50, unit_cost=3500)
            p_order.save()
            
            # Receive
            receipt = PurchasingService.receive_order(p_order, warehouse)
            
            # Bill
            p_invoice = Invoice.objects.create(
                dte_type=Invoice.DTEType.PURCHASE_INV,
                number="P-5501",
                purchase_order=p_order,
                contact=supplier,
                total_net=p_order.total_net,
                total_tax=p_order.total_tax,
                total=p_order.total,
                status=Invoice.Status.POSTED,
                date=timezone.now().date()
            )
            self.stdout.write(f"    ✓ Demo Purchase Flow: FCP-{p_invoice.number} created.")

    def _create_tax_demo(self, periods):
        """Creates an F29 declaration for the previous month."""
        prev_month = timezone.now().month - 1
        if prev_month == 0:
            return # Skip if it's January and we don't have prev year periods in demo
            
        period_data = next((p for p in periods if p['tax'].month == prev_month), None)
        if not period_data:
            return
            
        tax_period = period_data['tax']
        
        # Determine aggregate data from journal entries for that period
        from django.db.models import Sum
        start_date = timezone.datetime(tax_period.year, tax_period.month, 1).date()
        if tax_period.month == 12:
            end_date = timezone.datetime(tax_period.year + 1, 1, 1).date() - timezone.timedelta(days=1)
        else:
            end_date = timezone.datetime(tax_period.year, tax_period.month + 1, 1).date() - timezone.timedelta(days=1)

        # Sales
        sales_data = Invoice.objects.filter(
            date__range=[start_date, end_date],
            dte_type__in=[Invoice.DTEType.FACTURA, Invoice.DTEType.BOLETA],
            status=Invoice.Status.POSTED
        ).aggregate(net=Sum('total_net'))
        
        # Purchases
        purchases_data = Invoice.objects.filter(
            date__range=[start_date, end_date],
            dte_type=Invoice.DTEType.PURCHASE_INV,
            status=Invoice.Status.POSTED
        ).aggregate(net=Sum('total_net'))

        F29Declaration.objects.get_or_create(
            tax_period=tax_period,
            defaults={
                'declaration_date': timezone.now().date(),
                'folio_number': "99887766",
                'sales_taxed': sales_data['net'] or Decimal('2500000'), # Default if no data
                'purchases_taxed': purchases_data['net'] or Decimal('1200000'),
                'ppm_amount': Decimal('50000'),
                'withholding_tax': Decimal('15000'),
                'notes': "Declaración generada automáticamente por demo data."
            }
        )
        self.stdout.write(f"    ✓ Demo F29 Declaration created for {tax_period}.")
