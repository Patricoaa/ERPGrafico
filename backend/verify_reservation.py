import os
import django
import sys
from decimal import Decimal

# Add the project root to the python path
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from inventory.models import Product, Warehouse, StockMove
from sales.models import SaleOrder, SaleLine
from sales.services import SalesService
from django.core.exceptions import ValidationError
from contacts.models import Contact
from inventory.models import UoM

def run_test():
    print("Starting Verification Script...")
    
    # 1. Setup Data
    warehouse = Warehouse.objects.first()
    if not warehouse:
        warehouse = Warehouse.objects.create(name="Test Warehouse", code="WH-TEST")
        
    customer = Contact.objects.filter(is_customer=True).first()
    if not customer:
        customer = Contact.objects.create(name="Test Customer", is_customer=True)

    # Create a test product
    product_code = "TRP-VERIFY-001"
    
    # Clean up previous runs
    Product.objects.filter(code=product_code).delete()
    
    product = Product.objects.create(
        name="Test Reservation Product",
        code=product_code,
        price=100,
        cost_price=50,
        track_inventory=True,
        uom=UoM.objects.first() # Assume at least one UoM exists
    )
    print(f"Created Product: {product.name} ({product.code})")

    # Add Initial Stock
    StockMove.objects.create(
        product=product,
        warehouse=warehouse,
        quantity=10,
        move_type=StockMove.Type.IN,
        date='2024-01-01',
        description="Initial Stock"
    )
    print(f"Added 10 units stock.")
    print(f"Initial State -> On Hand: {product.qty_on_hand}, Reserved: {product.qty_reserved}, Available: {product.qty_available}")

    # 2. Test Case 1: Over-selling (Request 11, Available 10)
    print("\n--- Test Case 1: Over-selling (Req 11, Avail 10) ---")
    order1 = SaleOrder.objects.create(customer=customer, date='2024-01-01')
    SaleLine.objects.create(order=order1, product=product, quantity=11, price=100)
    
    try:
        SalesService.confirm_sale(order1)
        print("FAILURE: Order confirmed despite insufficient stock!")
    except ValidationError as e:
        print(f"SUCCESS: Validation Error caught: {e}")
    except Exception as e:
        print(f"ERROR: Unexpected exception: {e}")

    # 3. Test Case 2: Successful Sale (Request 5, Available 10)
    print("\n--- Test Case 2: Successful Sale (Req 5, Avail 10) ---")
    order2 = SaleOrder.objects.create(customer=customer, date='2024-01-01')
    SaleLine.objects.create(order=order2, product=product, quantity=5, price=100)
    
    try:
        SalesService.confirm_sale(order2)
        print("SUCCESS: Order confirmed.")
    except Exception as e:
        print(f"FAILURE: Order failed: {e}")

    # Check Stock after sale
    # Refresh logic might be needed if calculation is cached, but property usually isn't.
    # Product.objects.get(id=product.id)
    print(f"Stock after confirmed sale (5 units):")
    print(f"  On Hand: {product.qty_on_hand}")
    print(f"  Reserved: {product.qty_reserved}")
    print(f"  Available: {product.qty_available}")

    if product.qty_available != 5:
        print("WARNING: Available quantity is not 5 as expected!")

    # 4. Test Case 3: Subsequent Over-selling (Request 6, Available 5)
    print("\n--- Test Case 3: Subsequent Over-selling (Req 6, Avail 5) ---")
    order3 = SaleOrder.objects.create(customer=customer, date='2024-01-01')
    SaleLine.objects.create(order=order3, product=product, quantity=6, price=100)
    
    try:
        SalesService.confirm_sale(order3)
        print("FAILURE: Order confirmed despite insufficient stock!")
    except ValidationError as e:
        print(f"SUCCESS: Validation Error caught: {e}")

    # Cleanup
    print("\nCleaning up...")
    order1.delete()
    # order2 is confirmed, so deleting it might require more care or just cascade. 
    # For test script, standard delete is fine if not blocked.
    # Order 3 is draft.
    order3.delete()
    
    # Order 2 deletion might be blocked if we implemented block logic? No, only draft delete is restricted in service, model.delete() is usually standard.
    # But let's check delete_sale_order service constraint.
    # Just direct delete is fine for cleanup.
    order2.delete()
    product.delete()
    print("Cleanup done.")

if __name__ == "__main__":
    run_test()
