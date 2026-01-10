import os
import django
from rest_framework.test import APIRequestFactory

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from inventory.views import ProductViewSet

factory = APIRequestFactory()
request = factory.get('/api/inventory/products/stock_report/')
view = ProductViewSet.as_view({'get': 'stock_report'})

try:
    print("Testing stock_report endpoint...")
    response = view(request)
    print("Response status:", response.status_code)
    if response.status_code == 200:
         print("Success! Data sample:", response.data[:1] if response.data else "Empty")
    else:
         print("Error:", response.data)
except Exception as e:
    import traceback
    traceback.print_exc()
