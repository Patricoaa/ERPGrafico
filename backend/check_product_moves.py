import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from inventory.models import Product
from django.db.models import Sum

products = Product.objects.filter(product_type__in=[Product.Type.STORABLE, Product.Type.CONSUMABLE])
print(f"Found {products.count()} products.")

for p in products[:5]:
    try:
        qty = p.stock_moves.aggregate(total=Sum('quantity'))['total'] or 0
        print(f"Product {p.code}: Stock={qty}")
    except AttributeError as e:
        print(f"FAIL: {e}")
    except Exception as e:
        print(f"ERROR: {e}")
