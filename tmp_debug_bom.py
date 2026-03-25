import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from inventory.models import Product, BillOfMaterialsLines, UoM

p = Product.objects.get(id=643)
bom = p.boms.first()
print(f"Product: {p.name} (SKU: {p.internal_code})")
print(f"BOM: {bom.name if bom else 'None'}")

if bom:
    for line in bom.lines.all():
        component = line.component
        print(f"--- Line {line.id} ---")
        print(f"Component: {component.name} (ID: {component.id})")
        print(f"Line Qty: {line.quantity} {line.uom.name}")
        print(f"Component Stock: {component.qty_available} {component.uom.name}")
        print(f"UoM Context: Line UoM ID {line.uom_id}, Comp UoM ID {component.uom_id}")
        
        # Check ratios
        try:
            line_uom = line.uom
            comp_uom = component.uom
            print(f"Line UoM Ratio: {line_uom.ratio}, Category: {line_uom.category_id}")
            print(f"Comp UoM Ratio: {comp_uom.ratio}, Category: {comp_uom.category_id}")
            
            if line_uom.category_id == comp_uom.category_id:
                available_in_line_uom = (component.qty_available * comp_uom.ratio) / line_uom.ratio
                print(f"Available in Line UoM: {available_in_line_uom}")
                if line.quantity > 0:
                    max_possible = available_in_line_uom / line.quantity
                    print(f"Can manufacture: {max_possible}")
            else:
                print("ERROR: UoM categories mismatch!")
        except Exception as e:
            print(f"Error calculating: {e}")
else:
    print("No BOM found for this product.")
