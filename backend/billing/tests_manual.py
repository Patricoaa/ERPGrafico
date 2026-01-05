
import os
import django
from decimal import Decimal

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from billing.models import Invoice
from billing.services import BillingService
from purchasing.models import PurchaseOrder, Supplier
from accounting.models import AccountingSettings, Account, JournalItem
from inventory.models import Warehouse
from django.utils import timezone

def test_boleta_vat_capitalization():
    print("\n--- Testing Boleta VAT Capitalization ---")
    
    # Setup test data
    supplier, _ = Supplier.objects.get_or_create(name="Test Supplier VAT")
    warehouse, _ = Warehouse.objects.get_or_create(name="Main Test Wh")
    
    po = PurchaseOrder.objects.create(
        supplier=supplier,
        warehouse=warehouse,
        total_net=Decimal('10000'),
        total_tax=Decimal('1900'),
        total=Decimal('11900'),
        status='CONFIRMED'
    )
    
    # Ensure settings exist
    settings = AccountingSettings.objects.first()
    if not settings:
        print("Error: AccountingSettings not found")
        return

    # Test FACTURA
    print("Test 1: Factura (Should separate VAT)")
    factura = BillingService.create_purchase_bill(po, "FACT-123", dte_type=Invoice.DTEType.FACTURA)
    items = JournalItem.objects.filter(entry=factura.journal_entry)
    
    tax_items = items.filter(account=settings.default_tax_receivable_account)
    stock_items = items.filter(account=settings.stock_input_account or settings.default_inventory_account)
    
    print(f"Factura entry id: {factura.journal_entry.id}")
    print(f"Tax items count: {tax_items.count()} (Expected: 1)")
    print(f"Stock items debit: {stock_items.first().debit} (Expected: 10000.00)")
    
    # Test BOLETA
    print("\nTest 2: Boleta (Should capitalize VAT)")
    boleta = BillingService.create_purchase_bill(po, "BOL-456", dte_type=Invoice.DTEType.BOLETA)
    b_items = JournalItem.objects.filter(entry=boleta.journal_entry)
    
    b_tax_items = b_items.filter(account=settings.default_tax_receivable_account)
    b_stock_items = b_items.filter(account=settings.stock_input_account or settings.default_inventory_account).last()
    
    print(f"Boleta entry id: {boleta.journal_entry.id}")
    print(f"Tax items count: {b_tax_items.count()} (Expected: 0)")
    print(f"Stock items debit: {b_stock_items.debit} (Expected: 11900.00)")
    print(f"Labels: {[i.label for i in b_items]}")

if __name__ == "__main__":
    test_boleta_vat_capitalization()
