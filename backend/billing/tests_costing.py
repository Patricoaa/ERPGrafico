from django.test import TestCase
from decimal import Decimal
from django.utils import timezone
from inventory.models import Product, ProductCategory, Warehouse, StockMove
from purchasing.models import PurchaseOrder, PurchaseLine
from billing.models import Invoice
from billing.services import BillingService
from purchasing.services import PurchasingService
from contacts.models import Contact
from accounting.models import Account, AccountType, AccountingSettings

class CostingTestCase(TestCase):
    def setUp(self):
        # 1. Setup Accounts
        self.asset_account = Account.objects.create(code="1.1.01", name="Mercaderías", account_type=AccountType.ASSET)
        self.liability_account = Account.objects.create(code="2.1.01", name="Proveedores", account_type=AccountType.LIABILITY)
        self.tax_account = Account.objects.create(code="1.1.02", name="IVA Crédito Fiscal", account_type=AccountType.ASSET)
        self.stock_input_account = Account.objects.create(code="2.1.02", name="Facturas por Recibir", account_type=AccountType.LIABILITY)
        
        self.settings = AccountingSettings.objects.create(
            default_inventory_account=self.asset_account,
            default_payable_account=self.liability_account,
            default_tax_receivable_account=self.tax_account,
            stock_input_account=self.stock_input_account
        )

        # 2. Setup Master Data
        self.category = ProductCategory.objects.create(name="General", asset_account=self.asset_account)
        self.product = Product.objects.create(
            name="Test Widget",
            code="WIDGET001",
            category=self.category,
            cost_price=0
        )
        self.warehouse = Warehouse.objects.create(name="Main Warehouse", code="WH01")
        self.supplier = Contact.objects.create(name="Supplier Inc", is_supplier=True)

    def test_boleta_capitalization_and_reception_overwrite(self):
        """
        Reproduces the issue where Boleta capitalization is overwritten by reception.
        """
        # 1. Create Purchase Order
        po = PurchaseOrder.objects.create(
            supplier=self.supplier,
            warehouse=self.warehouse,
            total_net=1000,
            total_tax=190,
            total=1190
        )
        PurchaseLine.objects.create(
            order=po,
            product=self.product,
            quantity=10,
            unit_cost=100
        )
        
        # 2. Bill as BOLETA (Should capitalize VAT)
        # We manually trigger "create_purchase_bill" as if from the UI
        invoice = BillingService.create_purchase_bill(
            order=po,
            supplier_invoice_number="BOL-100",
            dte_type=Invoice.DTEType.BOLETA,
            status=Invoice.Status.POSTED
        )
        
        # Verify Product Cost after Billing (Should include VAT)
        # total cost = 1000 + 190 = 1190. Qty = 10. Unit Cost = 119.
        self.product.refresh_from_db()
        print(f"DEBUG: Cost after Boleta Bill: {self.product.cost_price}")
        self.assertEqual(self.product.cost_price, Decimal('119.00'), 
                        "Cost should be capitalized to 119.00 (100 + 19 VAT) after billing as Boleta")

        # 3. Receive Merchandise
        # This is where the bug happens: Reception uses PO Net Cost (100) and overwrites the capitalized cost.
        PurchasingService.receive_order(po, self.warehouse)
        
        self.product.refresh_from_db()
        print(f"DEBUG: Cost after Reception: {self.product.cost_price}")
        
        # Assert FAILURE (This is what we expect to fail right now)
        # If it passes, then the bug is different than I thought.
        # But based on analysis: confirmation of receipt does _update_product_cost with unit_cost passed (which comes from PO line = 100)
        self.assertEqual(self.product.cost_price, Decimal('119.00'),
                        "Cost should REMAIN 119.00 after reception, but it was likely overwritten to 100.00")

    def test_draft_invoice_reversion(self):
        """
        Tests that provisional capitalization from Draft Factura is correctly corrected when confirmed.
        """
        # Clean product cost
        self.product.cost_price = 0
        self.product.save()

        # 1. Create Purchase Order
        po = PurchaseOrder.objects.create(
            supplier=self.supplier,
            warehouse=self.warehouse,
            total_net=1000,
            total_tax=190,
            total=1190
        )
        PurchaseLine.objects.create(
            order=po,
            product=self.product,
            quantity=10,
            unit_cost=100
        )

        # 2. Create DRAFT Invoice (Should capitalize provisionally)
        invoice = BillingService.create_purchase_bill(
            order=po,
            dte_type=Invoice.DTEType.FACTURA,
            status=Invoice.Status.DRAFT
        )

        self.product.refresh_from_db()
        print(f"DEBUG: Cost after Draft Invoice: {self.product.cost_price}")
        self.assertEqual(self.product.cost_price, Decimal('119.00'), "Draft Factura should provisionally capitalize VAT")

        # 3. Confirm Invoice (Should revert capitalization and post VAT to Tax Account)
        BillingService.confirm_invoice(invoice, number="FAC-999")
        
        # RELOAD product to see if cost was adjusted back technically? 
        # Wait, the current logic only adjusts the JOURNAL ENTRY, it does NOT adjust the Product Cost Price back!
        # This is another bug I found during analysis but didn't explicitly detail in the first test.
        # The `BillingService.confirm_invoice` logic iterates accounting items but does NOT touch `Product.cost_price`.
        
        self.product.refresh_from_db()
        print(f"DEBUG: Cost after Confirm Invoice: {self.product.cost_price}")
        self.assertEqual(self.product.cost_price, Decimal('100.00'), 
                        "Cost should revert to Net (100.00) after confirming Factura, but logic is missing.")
