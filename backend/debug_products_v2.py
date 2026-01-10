import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from inventory.models import Product
from inventory.serializers import ProductSerializer

try:
    product = Product.objects.first()
    if product:
        print(f"Testing serialization for product: {product.name}")
        serializer = ProductSerializer(product)
        print("Serialized Data:", serializer.data['current_stock']) # Access the field that was failing
        print("Success!")
    else:
        print("No products found to test.")
except Exception as e:
    import traceback
    traceback.print_exc()
