
import os
import django
from decimal import Decimal

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from inventory.models import Product, ProductCategory, UoM, UoMCategory, Warehouse, StockMove
from purchasing.models import PurchaseOrder, PurchaseLine, PurchaseReceipt
from billing.models import Invoice
from billing.services import BillingService
from purchasing.services import PurchasingService

def run_repro():
    print("--- Repro: Boleta Cost Sync with UoM Conversion ---")
    
    # 1. Setup Data
    cat, _ = ProductCategory.objects.get_or_create(name="Test Cat")
    uom_cat, _ = UoMCategory.objects.get_or_create(name="Weight")
    base_uom, _ = UoM.objects.get_or_create(name="kg", category=uom_cat, ratio=1, uom_type='REFERENCE')
    box_uom, _ = UoM.objects.get_or_create(name="box_10kg", category=uom_cat, ratio=10, uom_type='BIGGER')
    
    prod, _ = Product.objects.get_or_create(
        name="Repro Product",
        category=cat,
        uom=base_uom,
        product_type='STORABLE',
        cost_price=0
    )
    
    warehouse, _ = Warehouse.objects.get_or_create(name="Main", code="MAIN")
    
    from contacts.models import Contact
    supplier, _ = Contact.objects.get_or_create(name="Test Supplier", contact_type='SUPPLIER')
    
    # 2. Create Purchase Order with Box UoM
    po = PurchaseOrder.objects.create(supplier=supplier, warehouse=warehouse)
    line = PurchaseLine.objects.create(
        order=po,
        product=prod,
        quantity=2,  # 2 boxes = 20kg
        uom=box_uom,
        unit_cost=1000, # 1000 per box ($100 per kg)
        tax_rate=19
    )
    po.recalculate_totals()
    po.save()
    
    print(f"PO created: {po.display_id}, Line Cost: {line.unit_cost} per {line.uom.name}")
    
    # 3. Receive Order (BEFORE Boleta)
    receipt = PurchasingService.receive_order(po, warehouse)
    print(f"Receipt confirmed. Checking StockMove cost...")
    
    move = StockMove.objects.filter(product=prod, description__contains=po.number).first()
    print(f"StockMove Quantity: {move.quantity} {move.uom.name}")
    print(f"StockMove Unit Cost (Net): {move.unit_cost}")
    
    expected_net_kg_cost = Decimal('100')
    if move.unit_cost != expected_net_kg_cost:
        print(f"ERROR: Expected {expected_net_kg_cost}, got {move.unit_cost}")
    
    # 4. Create Boleta (Capitalize tax)
    print(f"Creating Boleta for PO...")
    invoice = BillingService.create_purchase_bill(
        order=po,
        supplier_invoice_number="BOL-123",
        dte_type=Invoice.DTEType.BOLETA,
        status=Invoice.Status.POSTED
    )
    
    # 5. Check if StockMove was updated
    move.refresh_from_db()
    print(f"StockMove Unit Cost after Boleta: {move.unit_cost}")
    
    expected_gross_kg_cost = Decimal('119')
    if move.unit_cost == expected_gross_kg_cost:
        print("SUCCESS: Boleta cost sync worked!")
    else:
        print(f"FAILURE: Boleta cost sync discrepancy! Expected {expected_gross_kg_cost}, got {move.unit_cost}")
    
    # Cleanup (Optional)
    # po.delete()
    # prod.delete()

if __name__ == "__main__":
    run_repro()
