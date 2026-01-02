from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SupplierViewSet, PurchaseOrderViewSet, PurchaseReceiptViewSet

router = DefaultRouter()
router.register(r'suppliers', SupplierViewSet)
router.register(r'orders', PurchaseOrderViewSet)
router.register(r'receipts', PurchaseReceiptViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
