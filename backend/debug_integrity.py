import os
import django
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from inventory.models import Product, Warehouse, StockMove

def test():
    try:
        p = Product.objects.get(id=100)
        w = Warehouse.objects.first()
        print(f"Testing StockMove creation for Product {p.id}, Warehouse {w.id}, UoM {p.uom.id}")
        move = StockMove.objects.create(
            product=p,
            warehouse=w,
            uom=p.uom,
            quantity=-1,
            move_type='OUT',
            description='Integrity test with UoM'
        )
        print(f"Success! Created move {move.id}")
    except Exception as e:
        print(f"CAUGHT: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test()
