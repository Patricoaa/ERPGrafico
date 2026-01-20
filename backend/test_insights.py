import os
import django
import sys

# Add the current directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from inventory.models import Product
from inventory.views import ProductViewSet
from rest_framework.test import APIRequestFactory, force_authenticate
from core.models import User

def test_insights():
    product = Product.objects.first()
    if not product:
        print("No products found to test.")
        return
    
    with open('debug_product.txt', 'w') as f:
        f.write(f"Product all fields: {[f.name for f in product._meta.get_fields()]}\n")
        for field in product._meta.get_fields():
            f.write(f"Field: {field.name}, Type: {type(field)}\n")
            if hasattr(field, 'related_name'):
                f.write(f"  Related Name: {field.related_name}\n")
    
    print("Debug info written to debug_product.txt")

    user = User.objects.filter(is_superuser=True).first()
    factory = APIRequestFactory()
    view = ProductViewSet.as_view({'get': 'insights'})
    
    request = factory.get(f'/api/inventory/products/{product.id}/insights/')
    force_authenticate(request, user=user)
    
    try:
        response = view(request, pk=product.id)
        print(f"Status: {response.status_code}")
        print(f"Keys: {response.data.keys()}")
    except AttributeError as e:
        print(f"AttributeError: {e}")
        with open('debug_dir.txt', 'w') as f:
            f.write(str(dir(product)))
        print("Dir(product) written to debug_dir.txt")

if __name__ == "__main__":
    test_insights()
