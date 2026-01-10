import os
import django
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from inventory.views import ProductViewSet

factory = APIRequestFactory()
request = factory.get('/api/inventory/products/')
view = ProductViewSet.as_view({'get': 'list'})

try:
    response = view(request)
    print("Response status:", response.status_code)
except Exception as e:
    import traceback
    traceback.print_exc()
