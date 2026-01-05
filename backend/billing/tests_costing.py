"""
Test script for inventory costing with Boletas.
This script tests that VAT is correctly capitalized for Boleta purchases.
"""
from django.test import TestCase
from decimal import Decimal
from inventory.models import Product, ProductCategory, Warehouse
from purchasing.models import PurchaseOrder, PurchaseLine
from purchasing.services import PurchasingService
from billing.services import BillingService
from contacts.models import Contact
from accounting.models import AccountingSettings, Account, AccountType
from django.utils import timezone


class InventoryCostingTestCase(TestCase):
    def setUp(self):
        """Set up test data"""
        # Create accounting settings
        self.settings = AccountingSettings.objects.create()
        
        # Create accounts
        self.inventory_account = Account.objects.create(
            code="1100",
            name="Inventario",
            account_type=AccountType.ASSET
        )
        self.payable_account = Account.objects.create(
            code="2100",
            name="Cuentas por Pagar",
            account_type=AccountType.LIABILITY
        )
        self.stock_input_account = Account.objects.create(
            code="2150",
            name="Facturas por Recibir",
            account_type=AccountType.LIABILITY
        )
        self.tax_receivable_account = Account.objects.create(
            code="1200",
            name="IVA Crédito Fiscal",
            account_type=AccountType.ASSET
        )
        
        self.settings.default_inventory_account = self.inventory_account
        self.settings.default_payable_account = self.payable_account
        self.settings.stock_input_account = self.stock_input_account
        self.settings.default_tax_receivable_account = self.tax_receivable_account
        self.settings.save()
        
        # Create category
        self.category = ProductCategory.objects.create(
            name="Test Category",
            asset_account=self.inventory_account
        )
        
        # Create product
        self.product = Product.objects.create(
            code="TEST001",
            name="Test Product",
            category=self.category,
            cost_price=Decimal('0')
        )
        
        # Create warehouse
        self.warehouse = Warehouse.objects.create(
            code="WH01",
            name="Main Warehouse"
        )
        
        # Create supplier
        self.supplier = Contact.objects.create(
            name="Test Supplier",
            contact_type="SUPPLIER",
            account_payable=self.payable_account
        )
    
    def test_boleta_capitalizes_vat(self):
        """Test that Boleta purchases capitalize VAT into product cost"""
        # Create PO with Net $1000 and 19% Tax
        po = PurchaseOrder.objects.create(
            supplier=self.supplier,
            warehouse=self.warehouse,
            total_net=Decimal('1000'),
            total_tax=Decimal('190'),
            total=Decimal('1190'),
            status='CONFIRMED'
        )
        
        PurchaseLine.objects.create(
            order=po,
            product=self.product,
            quantity=Decimal('10'),
            unit_cost=Decimal('100'),  # Net unit cost
            tax_rate=Decimal('19.00'),
            subtotal=Decimal('1000')
        )
        
        # Receive the PO first
        receipt = PurchasingService.receive_order(
            order=po,
            warehouse=self.warehouse,
            receipt_date=timezone.now().date()
        )
        
        # Refresh product
        self.product.refresh_from_db()
        # After reception, cost should be Net (100)
        self.assertEqual(self.product.cost_price, Decimal('100'))
        
        # Bill as Boleta
        invoice = BillingService.create_purchase_bill(
            order=po,
            supplier_invoice_number='BOL-001',
            dte_type='BOLETA',
            status='POSTED'
        )
        
        # Refresh product
        self.product.refresh_from_db()
        # After Boleta, cost should include VAT: 100 + 19 = 119
        self.assertEqual(self.product.cost_price, Decimal('119'))
    
    def test_boleta_then_receive_preserves_vat(self):
        """Test that receiving after Boleta preserves VAT capitalization"""
        # Create PO
        po = PurchaseOrder.objects.create(
            supplier=self.supplier,
            warehouse=self.warehouse,
            total_net=Decimal('1000'),
            total_tax=Decimal('190'),
            total=Decimal('1190'),
            status='CONFIRMED'
        )
        
        PurchaseLine.objects.create(
            order=po,
            product=self.product,
            quantity=Decimal('10'),
            unit_cost=Decimal('100'),
            tax_rate=Decimal('19.00'),
            subtotal=Decimal('1000')
        )
        
        # Bill as Boleta FIRST
        invoice = BillingService.create_purchase_bill(
            order=po,
            supplier_invoice_number='BOL-002',
            dte_type='BOLETA',
            status='POSTED'
        )
        
        # Refresh product
        self.product.refresh_from_db()
        # Cost should be 119 (100 + 19)
        self.assertEqual(self.product.cost_price, Decimal('119'))
        
        # Now receive the PO
        receipt = PurchasingService.receive_order(
            order=po,
            warehouse=self.warehouse,
            receipt_date=timezone.now().date()
        )
        
        # Refresh product
        self.product.refresh_from_db()
        # Cost should STILL be 119, not overwritten to 100
        self.assertEqual(self.product.cost_price, Decimal('119'))
    
    def test_draft_factura_then_confirm_reverts_vat(self):
        """Test that confirming a draft Factura reverts capitalized VAT"""
        # Create PO
        po = PurchaseOrder.objects.create(
            supplier=self.supplier,
            warehouse=self.warehouse,
            total_net=Decimal('1000'),
            total_tax=Decimal('190'),
            total=Decimal('1190'),
            status='CONFIRMED'
        )
        
        PurchaseLine.objects.create(
            order=po,
            product=self.product,
            quantity=Decimal('10'),
            unit_cost=Decimal('100'),
            tax_rate=Decimal('19.00'),
            subtotal=Decimal('1000')
        )
        
        # Receive first
        receipt = PurchasingService.receive_order(
            order=po,
            warehouse=self.warehouse,
            receipt_date=timezone.now().date()
        )
        
        # Create Draft Factura
        invoice = BillingService.create_purchase_bill(
            order=po,
            supplier_invoice_number='',
            dte_type='FACTURA',
            status='DRAFT'
        )
        
        # Refresh product
        self.product.refresh_from_db()
        # Cost should be 119 (provisionally capitalized)
        self.assertEqual(self.product.cost_price, Decimal('119'))
        
        # Confirm the Factura
        BillingService.confirm_invoice(invoice, 'FACT-001')
        
        # Refresh product
        self.product.refresh_from_db()
        # Cost should revert to 100 (VAT is now recoverable)
        self.assertEqual(self.product.cost_price, Decimal('100'))


if __name__ == '__main__':
    import django
    import os
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'erp.settings')
    django.setup()
    
    from django.test.utils import get_runner
    TestRunner = get_runner(django.conf.settings)
    test_runner = TestRunner()
    failures = test_runner.run_tests(["__main__"])
