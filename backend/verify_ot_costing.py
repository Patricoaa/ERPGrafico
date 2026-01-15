import os
import django
from decimal import Decimal

# Setup Django Environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from inventory.models import Product, ProductCategory, UoM, Warehouse, StockMove
from production.models import WorkOrder, WorkOrderMaterial
from production.services import WorkOrderService
from inventory.services import StockService

def verify_costing():
    print("--- Starting OT Costing Verification ---")

    # 1. Setup Data
    # Warehouse
    warehouse = Warehouse.objects.first()
    if not warehouse:
        warehouse = Warehouse.objects.create(name="Test Warehouse", code="TEST-WH")
    
    # UoM
    uom_unit = UoM.objects.filter(name="Unidad").first() or UoM.objects.create(name="Unidad", ratio=1)
    
    # Category
    cat = ProductCategory.objects.filter(name="Test Category").first()
    if not cat:
        cat = ProductCategory.objects.create(name="Test Category")

    # Components
    comp1, _ = Product.objects.get_or_create(
        code="COMP-TEST-1",
        defaults={
            'name': "Component 1", 
            'category': cat,
            'product_type': Product.Type.STORABLE,
            'uom': uom_unit,
            'cost_price': Decimal('100.00'), # Cost 100
            'sale_price': 200,
            'track_inventory': True
        }
    )
    # Ensure cost is 100
    comp1.cost_price = Decimal('100.00')
    comp1.save()
    
    # Add stock for component
    # We need stock to consume? finalize_production allows negative stock (it doesn't check strict availability inside the method, creates OUT move).
    # Ideally we add positive stock first.
    StockService.adjust_stock(comp1, warehouse, 100, 100, "Initial Stock")

    # Finished Product
    # let's say we have 10 units at cost 500 currently.
    prod, _ = Product.objects.get_or_create(
        code="PROD-MANUF-TEST",
        defaults={
            'name': "Manufacturable Product",
            'category': cat,
            'product_type': Product.Type.MANUFACTURABLE,
            'uom': uom_unit,
            'cost_price': Decimal('500.00'),
            'sale_price': 1000,
            'track_inventory': True
        }
    )
    # Set initial state
    prod.cost_price = Decimal('500.00')
    prod.save()
    # Add initial stock: 10 units @ 500
    # adjust_stock updates WAC, so let's just force the state via moves if needed, or rely on adjust_stock
    # Current: Qty=0. Let's add 10 units.
    # Check current qty
    qty_curr = prod.qty_on_hand
    if qty_curr > 0:
        # adjust to 0 first? Or just work with what we have.
        print(f"Current Stock: {qty_curr}")
        # Reset for test
        # Not easily possible without deleting moves. I'll just use the current values in calculation check.
    else:
        StockService.adjust_stock(prod, warehouse, 10, 500, "Initial Finished Stock")
    
    prod.refresh_from_db()
    initial_qty = prod.qty_on_hand
    initial_cost = prod.cost_price
    initial_value = initial_qty * initial_cost
    
    print(f"Product Initial: Qty={initial_qty}, Cost={initial_cost}, Value={initial_value}")

    # 2. Create Manual OT
    print("\n2. Creating Manual OT for 5 units...")
    ot = WorkOrderService.create_manual(
        product=prod,
        quantity=5,
        description="Test Costing OT",
        warehouse=warehouse
    )
    
    # Add Material
    # We need 2 comps per unit -> 10 comps total. Cost = 10 * 100 = 1000.
    WorkOrderService.add_material(ot, comp1, 10)
    
    print(f"OT Created: {ot.number}. Planned Quantity: 5. Material Cost Expected: 10 * 100 = 1000.")
    print(f"Production Unit Cost Expected: 1000 / 5 = 200.")
    
    # 3. Finalize
    print("\n3. Finalizing Production...")
    WorkOrderService.finalize_production(ot)
    
    # 4. Verify
    prod.refresh_from_db()
    final_qty = prod.qty_on_hand
    final_cost = prod.cost_price
    
    print(f"\nProduct Final: Qty={final_qty}, Cost={final_cost}")
    
    # Calculation
    # New production: 5 units @ 200 cost each. Value = 1000.
    # Old stock: initial_qty @ initial_cost. Value = initial_value.
    # Expected Total Qty = initial_qty + 5.
    # Expected Total Value = initial_value + 1000.
    # Expected Avg Cost = (initial_value + 1000) / (initial_qty + 5).
    
    expected_qty = initial_qty + 5
    expected_value = initial_value + 1000
    expected_cost = expected_value / expected_qty
    
    print(f"\nVerification:")
    print(f"Expected Qty: {expected_qty} vs Actual: {final_qty}")
    print(f"Expected Cost: {expected_cost:.2f} vs Actual: {final_cost}")
    
    tolerance = Decimal('0.1')
    if abs(final_cost - expected_cost) < tolerance:
        print("\n✅ SUCCESS: Cost updated correctly using Weighted Average.")
    else:
        print("\n❌ FAILURE: Cost mismatch.")
        exit(1)

if __name__ == "__main__":
    verify_costing()
