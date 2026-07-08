from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import PurchaseOrderViewSet, PurchaseReceiptViewSet, PurchaseReturnViewSet

router = DefaultRouter()
router.register(r"orders", PurchaseOrderViewSet, basename="purchaseorder")
router.register(r"receipts", PurchaseReceiptViewSet, basename="purchasereceipt")
router.register(r"returns", PurchaseReturnViewSet, basename="purchasereturn")

urlpatterns = [
    path("", include(router.urls)),
]
