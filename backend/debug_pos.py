import os
import django
import traceback

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from inventory.models import Product, Warehouse
from inventory.services import ProcurementService

def test():
    try:
        p = Product.objects.get(id=100)
        w = Warehouse.objects.first()
        print(f"Testing replenishment for: {p.name} in {w.name}")
        res = ProcurementService.check_replenishment(p, w)
        print(f"Result: {res}")
    except Exception:
        traceback.print_exc()

if __name__ == "__main__":
    test()
