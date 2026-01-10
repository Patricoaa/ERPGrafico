import django
import os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from inventory.models import Product, UoM, UoMCategory, StockMove, Warehouse
from production.models import BillOfMaterials, BillOfMaterialsLine

# 1. Setup UoMs (Meter and Centimeter)
# Assuming categories might exist, but let's create temp ones for safety or find existing
try:
    len_cat = UoMCategory.objects.get(name='Length_Test')
except UoMCategory.DoesNotExist:
    len_cat = UoMCategory.objects.create(name='Length_Test')

meter, _ = UoM.objects.get_or_create(
    name='Meter_Test', category=len_cat, 
    defaults={'uom_type': 'REFERENCE', 'ratio': 1.0}
)
centimeter, _ = UoM.objects.get_or_create(
    name='Centimeter_Test', category=len_cat, 
    defaults={'uom_type': 'SMALLER', 'ratio': 0.01}
)

# 2. Products
warehouse, _ = Warehouse.objects.get_or_create(name='Test Warehouse', code='TW')

# Raw Material (Fabric) - Base UoM: Meter
fabric = Product.objects.create(
    name='Test Fabric',
    product_type='STORABLE',
    uom=meter
)
# Add 10 Meters of stock
StockMove.objects.create(
    product=fabric,
    warehouse=warehouse,
    quantity=10, # 10 Meters
    move_type='IN',
    date='2024-01-01'
)

# Finished Product (Shirt)
shirt = Product.objects.create(
    name='Test Shirt',
    product_type='MANUFACTURABLE',
    uom=meter # Unit doesn't matter much for manufacturing count, but standard
)

# 3. BOM (Requires 50 cm per shirt)
bom = BillOfMaterials.objects.create(product=shirt, name='Shirt BOM')
line = BillOfMaterialsLine.objects.create(
    bom=bom,
    component=fabric,
    quantity=50, # 50 units of...
    uom=centimeter # ...Centimeters
)

# 4. Calculation
# Required per unit: 50 cm * 0.01 = 0.5 m
# Stock: 10 m
# Expected Manufacturable: 10 / 0.5 = 20

qty = shirt.get_manufacturable_quantity()
print(f"Stock: {fabric.get_current_stock(fabric)} {fabric.uom.name}")
print(f"Requirement per unit: {line.quantity} {line.uom.name}")
print(f"Calculated Manufacturable Quantity: {qty}")

if qty == 20:
    print("SUCCESS: Calculation matches expected 20 units.")
else:
    print(f"FAILURE: Expected 20, got {qty}")

# Cleanup
line.delete()
bom.delete()
StockMove.objects.filter(product=fabric).delete()
fabric.delete()
shirt.delete()
