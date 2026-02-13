import os
import django
import datetime
from django.utils import timezone

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from sales.models import SaleOrder
from purchasing.models import PurchaseOrder
from accounting.models import JournalEntry
from production.models import ProductionConsumption, WorkOrder
from contacts.models import Contact
from inventory.models import Product, Warehouse, ProductCategory

def verify_mocking():
    print(f"Current timezone.now(): {timezone.now()}")
    
    # Get the mock date from settings
    from django.conf import settings
    mock_date = getattr(settings, 'MOCK_DATE', None)
    print(f"MOCK_DATE from settings: {mock_date}")
    
    if not mock_date:
        print("MOCK_DATE not configured in settings. Cannot verify mocking.")
        return

    # Create dummy data for testing
    category, _ = ProductCategory.objects.get_or_create(name="Test Category")
    contact, _ = Contact.objects.get_or_create(tax_id="12345678-9", defaults={"name": "Test Contact"})
    product, _ = Product.objects.get_or_create(code="TEST-PROD", defaults={"name": "Test Product", "product_type": "STORABLE", "category": category})
    warehouse, _ = Warehouse.objects.get_or_create(name="Test Warehouse")

    print("\n--- Testing SaleOrder ---")
    so = SaleOrder.objects.create(customer=contact)
    # Ensure we only compare the date part
    so_date_str = so.date.strftime("%Y-%m-%d") if hasattr(so.date, 'strftime') else str(so.date)
    mock_date_str = mock_date.strftime("%Y-%m-%d")
    print(f"SaleOrder date: {so.date} (str: {so_date_str})")
    assert so_date_str == mock_date_str, f"Expected {mock_date_str}, got {so_date_str}"
    print("SaleOrder date is correctly mocked!")

    print("\n--- Testing PurchaseOrder ---")
    po = PurchaseOrder.objects.create(supplier=contact)
    po_date_str = po.date.strftime("%Y-%m-%d") if hasattr(po.date, 'strftime') else str(po.date)
    print(f"PurchaseOrder date: {po.date} (str: {po_date_str})")
    assert po_date_str == mock_date_str, f"Expected {mock_date_str}, got {po_date_str}"
    print("PurchaseOrder date is correctly mocked!")

    print("\n--- Testing JournalEntry ---")
    je = JournalEntry.objects.create(description="Test Entry")
    je_date_str = je.date.strftime("%Y-%m-%d") if hasattr(je.date, 'strftime') else str(je.date)
    print(f"JournalEntry date: {je.date} (str: {je_date_str})")
    assert je_date_str == mock_date_str, f"Expected {mock_date_str}, got {je_date_str}"
    print("JournalEntry date is correctly mocked!")

    print("\n--- Testing ProductionConsumption ---")
    # Need a Work Order first
    wo = WorkOrder.objects.create(description="Test WO")
    pc = ProductionConsumption.objects.create(work_order=wo, product=product, warehouse=warehouse, quantity=1)
    pc_date_str = pc.date.strftime("%Y-%m-%d") if hasattr(pc.date, 'strftime') else str(pc.date)
    print(f"ProductionConsumption date: {pc.date} (str: {pc_date_str})")
    assert pc_date_str == mock_date_str, f"Expected {mock_date_str}, got {pc_date_str}"
    print("ProductionConsumption date is correctly mocked!")

    # Cleanup in correct order
    try:
        pc.delete()
        wo.delete()
        so.delete()
        po.delete()
        je.delete()
        product.delete()
        category.delete()
        warehouse.delete()
        contact.delete()
        print("\nCleanup done. All tests passed!")
    except Exception as e:
        print(f"\nCleanup failed (but tests passed): {e}")

if __name__ == "__main__":
    verify_mocking()
