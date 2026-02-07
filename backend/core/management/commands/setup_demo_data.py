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
from sales.models import SaleOrder, SaleLine, SaleDelivery, SaleDeliveryLine, SaleReturn, SaleReturnLine
from purchasing.models import PurchaseOrder, PurchaseLine, PurchaseReceipt, PurchaseReceiptLine, PurchaseReturn, PurchaseReturnLine
from treasury.models import (
    TreasuryAccount, TreasuryMovement, BankStatement, BankStatementLine,
    ReconciliationMatch, ReconciliationRule, CardPaymentProvider,
    DailySettlement, CardTransaction,
    CashDifference,
    POSTerminal, POSSession, POSSessionAudit
)
from billing.models import Invoice, NoteWorkflow
# from services.models import ServiceCategory, ServiceContract, ServiceObligation (Removed)
from production.models import BillOfMaterials, BillOfMaterialsLine, WorkOrder, ProductionConsumption
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
        self._create_treasury_infrastructure(accounts)


        self.stdout.write(self.style.SUCCESS('Successfully seeded demo data for Graphic Industry!'))

    def _configure_inventory_accounting(self):
        # Ensure we have the necessary accounts for advanced inventory mapping
        
        # 4.2.02 - Ganancia por Ajuste de Inventario (Income)
        parent_42 = Account.objects.filter(code='4.2').first()
        if parent_42:
            acc_gain, _ = Account.objects.get_or_create(
                code='4.2.02',
                defaults={
                    'name': 'Ganancia por Ajuste de Inventario',
                    'account_type': AccountType.INCOME,
                    'parent': parent_42,
                    'is_category': None,
                    'cf_category': None,
                    'is_reconcilable': True
                }
            )
        else:
            acc_gain = None

        # 5.2.07 - Pérdida por Ajuste de Inventario (Expense)
        parent_52 = Account.objects.filter(code='5.2').first()
        if parent_52:
            acc_loss, _ = Account.objects.get_or_create(
                code='5.2.07',
                defaults={
                    'name': 'Pérdida por Ajuste de Inventario',
                    'account_type': AccountType.EXPENSE,
                    'parent': parent_52,
                    'is_category': None,
                    'cf_category': None,
                    'is_reconcilable': True
                }
            )
        else:
            acc_loss = None

        # 3.1.02 - Contrapartida Inicial de Inventario (Equity)
        parent_31 = Account.objects.filter(code='3.1').first()
        if parent_31:
            acc_initial, _ = Account.objects.get_or_create(
                code='3.1.02',
                defaults={
                    'name': 'Contrapartida Inicial de Inventario',
                    'account_type': AccountType.EQUITY,
                    'parent': parent_31,
                    'is_category': None,
                    'cf_category': None
                }
            )
        else:
            acc_initial = None
        
        # 5.1.03 - Costo por Revalorización (Expense - COGS related)
        parent_51 = Account.objects.filter(code='5.1').first()
        if parent_51:
            acc_reval, _ = Account.objects.get_or_create(
                code='5.1.03',
                defaults={
                    'name': 'Ajuste por Revalorización de Stock',
                    'account_type': AccountType.EXPENSE,
                    'parent': parent_51,
                    'is_category': None, # Inherits COST_OF_SALES
                    'cf_category': None
                }
            )
        else:
            acc_reval = None

        # Update Settings
        settings = AccountingSettings.objects.first()
        if settings:
            # Cuentas de ajuste (ya existentes)
            if acc_gain: settings.adjustment_income_account = acc_gain
            if acc_loss: settings.adjustment_expense_account = acc_loss
            if acc_initial: settings.initial_inventory_account = acc_initial
            if acc_reval: settings.revaluation_account = acc_reval
            
            # NUEVO: Configurar cuentas por tipo de producto
            inventory_account = Account.objects.filter(code='1.1.03.01').first()
            consumable_account = Account.objects.filter(code='5.2.05').first()
            
            if inventory_account:
                settings.storable_inventory_account = inventory_account
                settings.manufacturable_inventory_account = inventory_account
                self.stdout.write("  ✓ Cuentas de inventario por tipo configuradas")
            
            if consumable_account:
                settings.default_consumable_account = consumable_account
                self.stdout.write("  ✓ Cuenta de consumibles configurada")
            
            # Map COGS for distinct product types
            settings.merchandise_cogs_account = Account.objects.filter(code='5.1.01').first()
            if settings.merchandise_cogs_account:
                self.stdout.write("  ✓ Cuenta de costo de mercaderías configurada (5.1.01)")

            settings.manufactured_cogs_account = Account.objects.filter(code='5.1.02').first()
            if settings.manufactured_cogs_account:
                self.stdout.write("  ✓ Cuenta de costo de productos fabricados configurada (5.1.02)")

            # Map service expense account (5.1.03 - Costo de Servicios Prestados)
            service_expense_acc = Account.objects.filter(code='5.1.03').first()
            if service_expense_acc:
                settings.default_service_expense_account = service_expense_acc
                settings.default_subscription_expense_account = service_expense_acc
                self.stdout.write("  ✓ Cuenta de gastos por servicios/suscripción configurada (5.1.03)")

            # NUEVO: Mapeo de ingresos y suscripciones
            service_revenue_acc = Account.objects.filter(code='4.1.02').first()
            if service_revenue_acc:
                settings.default_service_revenue_account = service_revenue_acc
                settings.default_subscription_revenue_account = service_revenue_acc
                self.stdout.write("  ✓ Cuenta de ingresos por servicios/suscripción configurada")
            
            # NUEVO: Cuentas por Cobrar/Pagar por defecto
            ar_acc = Account.objects.filter(code='1.1.02.01').first()
            if ar_acc:
                settings.default_receivable_account = ar_acc
                self.stdout.write("  ✓ Cuenta por cobrar por defecto configurada (1.1.02.01)")
            
            ap_acc = Account.objects.filter(code='2.1.01.01').first()
            if ap_acc:
                settings.default_payable_account = ap_acc
                self.stdout.write("  ✓ Cuenta por pagar por defecto configurada (2.1.01.01)")
            
            # --- Reconciliation Accounts ---
            # 5.2.10 - Comisiones Bancarias
            acc_comm = None
            if parent_52:
                acc_comm, _ = Account.objects.get_or_create(code='5.2.10', defaults={
                    'name': 'Comisiones Bancarias', 'account_type': AccountType.EXPENSE, 'parent': parent_52, 'is_reconcilable': True
                })
                settings.bank_commission_account = acc_comm

            # 4.2.03 - Intereses Ganados
            acc_int = None
            if parent_42:
                acc_int, _ = Account.objects.get_or_create(code='4.2.03', defaults={
                    'name': 'Intereses Ganados', 'account_type': AccountType.INCOME, 'parent': parent_42, 'is_reconcilable': True
                })
                settings.interest_income_account = acc_int
            
            # 4.2.04 - Diferencia de Cambio
            acc_exchange = None
            if parent_42:
                acc_exchange, _ = Account.objects.get_or_create(code='4.2.04', defaults={
                    'name': 'Diferencia de Cambio', 'account_type': AccountType.INCOME, 'parent': parent_42, 'is_reconcilable': True
                })
                settings.exchange_difference_account = acc_exchange

            # 5.2.11 - Redondeo
            acc_rounding = None
            if parent_52:
                acc_rounding, _ = Account.objects.get_or_create(code='5.2.11', defaults={
                    'name': 'Ajuste por Redondeo', 'account_type': AccountType.EXPENSE, 'parent': parent_52, 'is_reconcilable': True
                })
                settings.rounding_adjustment_account = acc_rounding

            # 5.2.12 - Error
            acc_error = None
            if parent_52:
                acc_error, _ = Account.objects.get_or_create(code='5.2.12', defaults={
                    'name': 'Ajuste por Error', 'account_type': AccountType.EXPENSE, 'parent': parent_52, 'is_reconcilable': True
                })
                settings.error_adjustment_account = acc_error

            # 5.2.13 - Comisión Tarjeta
            acc_card_comm = None
            if parent_52:
                acc_card_comm, _ = Account.objects.get_or_create(code='5.2.13', defaults={
                    'name': 'Comisión Tarjeta', 'account_type': AccountType.EXPENSE, 'parent': parent_52, 'is_reconcilable': True
                })
                settings.card_commission_account = acc_card_comm

            # 5.2.99 - Otros
            acc_misc = None
            if parent_52:
                acc_misc, _ = Account.objects.get_or_create(code='5.2.99', defaults={
                    'name': 'Otros Gastos Varios', 'account_type': AccountType.EXPENSE, 'parent': parent_52
                })
                settings.miscellaneous_adjustment_account = acc_misc

            self.stdout.write("  ✓ Cuentas de conciliación bancaria configuradas y mapeadas (incluye Comisión Tarjeta)")

            settings.pos_cash_difference_approval_threshold = Decimal('5000') # $5.000 CLP
            self.stdout.write("  ✓ Umbral de aprobación de diferencias POS configurado ($5.000)")

            # NUEVO: Mapeo de movimientos de caja POS hardcodeados y motivos especializados
            settings.pos_partner_withdrawal_account = Account.objects.filter(code='3.1.01.03').first() # Using specialized withdrawal if exists
            if not settings.pos_partner_withdrawal_account:
                settings.pos_partner_withdrawal_account = Account.objects.filter(code='3.1.03').first()
                
            settings.pos_theft_account = Account.objects.filter(code='5.2.14').first()
            settings.pos_other_inflow_account = Account.objects.filter(code='4.2.05').first()
            settings.pos_other_outflow_account = Account.objects.filter(code='5.2.15').first()
            
            # Specialized POS Accounts
            settings.pos_tip_account = Account.objects.filter(code='4.2.06').first()
            settings.pos_cashback_error_account = Account.objects.filter(code='5.2.16').first()
            settings.pos_counting_error_account = Account.objects.filter(code='5.2.17').first()
            settings.pos_system_error_account = Account.objects.filter(code='5.2.17').first()
            settings.pos_rounding_adjustment_account = Account.objects.filter(code='5.2.16').first()
            
            self.stdout.write("  ✓ Mapeos de motivos y movimientos manuales de caja POS configurados")

            settings.save()
            self.stdout.write("  ✓ Inventory and specialized accounting settings updated.")

    def _purge_data(self):
        from django.db import connection
        
        def _purge_legacy_tables():
            self.stdout.write("  Checking for legacy tables...")
            with connection.cursor() as cursor:
                # Tables that might exist in DB but not in current apps
                legacy_tables = [
                    'services_serviceobligation',
                    'services_servicecontract',
                    'services_servicecategory'
                ]
                for table in legacy_tables:
                    try:
                        with transaction.atomic():
                            cursor.execute(f"TRUNCATE TABLE {table} CASCADE;")
                        self.stdout.write(f"    ✓ Legacy table {table} truncated.")
                    except Exception:
                        # Table might not exist, ignore
                        pass

        _purge_legacy_tables()

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

        # Workflow models
        _safe_delete(Task, "Task")
        _safe_delete(Notification, "Notification")
        _safe_delete(TaskAssignmentRule, "TaskAssignmentRule")

        # Production child records
        _safe_delete(ProductionConsumption, "ProductionConsumption")
        _safe_delete(WorkOrder, "WorkOrder")
        _safe_delete(BillOfMaterialsLine, "BillOfMaterialsLine")
        _safe_delete(BillOfMaterials, "BillOfMaterials")

        _safe_delete(BudgetItem, "BudgetItem")
        _safe_delete(Budget, "Budget")

        # 2. Note Workflows (Reference Invoices)
        _safe_delete(NoteWorkflow, "NoteWorkflow")

        # 3. Subscriptions
        _safe_delete(Subscription, "Subscription")

        # 3. Transactional documents
        _safe_delete(TreasuryMovement, "TreasuryMovement")
        _safe_delete(Invoice, "Invoice")
        
        # Purchasing
        _safe_delete(PurchaseReturnLine, "PurchaseReturnLine")
        _safe_delete(PurchaseReturn, "PurchaseReturn")
        _safe_delete(PurchaseReceiptLine, "PurchaseReceiptLine")
        _safe_delete(PurchaseReceipt, "PurchaseReceipt")
        _safe_delete(PurchaseLine, "PurchaseLine")
        _safe_delete(PurchaseOrder, "PurchaseOrder")
        
        # Sales
        _safe_delete(SaleReturnLine, "SaleReturnLine")
        _safe_delete(SaleReturn, "SaleReturn")
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
        _safe_delete(ProductAttributeValue, "ProductAttributeValue")
        _safe_delete(ProductAttribute, "ProductAttribute")
        _safe_delete(ProductCategory, "ProductCategory")
        _safe_delete(Warehouse, "Warehouse")
        _safe_delete(Contact, "Contact")
        
        # 6. Treasury & Reconciliation
        _safe_delete(CardTransaction, "CardTransaction")
        _safe_delete(DailySettlement, "DailySettlement")
        _safe_delete(BankStatement, "BankStatement") # Cascades to lines
        _safe_delete(ReconciliationMatch, "ReconciliationMatch")
        _safe_delete(ReconciliationRule, "ReconciliationRule")
        _safe_delete(CardPaymentProvider, "CardPaymentProvider")
        # TreasuryAccount moved to end of section
        # _safe_delete(AccountingSettings, "AccountingSettings")
        _safe_delete(UoM, "UoM")
        _safe_delete(UoMCategory, "UoMCategory")
        
        # Treasury New Models
        _safe_delete(CashDifference, "CashDifference")
        _safe_delete(POSSessionAudit, "POSSessionAudit")
        _safe_delete(POSSession, "POSSession")
        _safe_delete(POSTerminal, "POSTerminal")
        
        # Now safe to delete TreasuryAccount
        _safe_delete(TreasuryAccount, "TreasuryAccount")

        
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
            'cogs_manufactured': Account.objects.get(code='5.1.02'), # NEW
            'cogs_service': Account.objects.get(code='5.1.03'), # Updated from 5.1.02
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

    def _create_treasury_infrastructure(self, accounts):
        self.stdout.write('  Creating POS Terminals and Treasury Physical Accounts...')
        
        manager_user = User.objects.get(username='gerente')

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
                'location': "Oficina Gerencia",
                'custodian': manager_user
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
                'is_physical': True,
                'location': "Mostrador 1"
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
                'is_physical': True,
                'location': "Administración",
                'custodian': manager_user
            }
        )
        
        # 1.1 New Additional Accounts
        bco01, _ = TreasuryAccount.objects.get_or_create(
            code="BCO-ESTADO",
            defaults={
                'name': "Banco Estado Empresa", 
                'currency': "CLP", 
                'account': accounts['bank'], 
                'account_type': TreasuryAccount.Type.BANK,
                'allows_cash': False,
                'allows_card': True,
                'allows_transfer': True
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
                'is_physical': True,
                'location': "Taller - Piso 2"
            }
        )

        bank_chile, _ = TreasuryAccount.objects.get_or_create(
            code="BCO-CHILE",
            defaults={
                'name': "Banco de Chile (Cta Corriente)",
                'currency': "CLP",
                'account': Account.objects.get(code='1.1.01.03'),
                'account_type': TreasuryAccount.Type.BANK,
                'allows_cash': False,
                'allows_card': True,
                'allows_transfer': True
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
                'is_physical': True,
                'location': "Recepción Principal"
            }
        )
        
        # 2. POS Terminals
        bank_account = bco01
        
        t1, _ = POSTerminal.objects.get_or_create(
            code="POS-01",
            defaults={
                'name': "Caja Central P1",
                'location': "Planta 1 - Recepción",
                'default_treasury_account': till1 # Linked to specific till account
            }
        )
        # Assign allowed accounts (Cash + Bank for Card/Transfer)
        t1.allowed_treasury_accounts.set([till1, bank_account, recepcion])

        t2, _ = POSTerminal.objects.get_or_create(
            code="POS-02",
            defaults={
                'name': "Caja Taller P2",
                'location': "Planta 2 - Taller",
                'default_treasury_account': caja01
            }
        )
        t2.allowed_treasury_accounts.set([caja01, bank_account])

        self.stdout.write("    ✓ Infrastructure created (Terminals, Safe, Tills as Accounts).")
