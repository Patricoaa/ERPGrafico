from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import PurchaseOrderViewSet, PurchaseReceiptViewSet, PurchaseReturnViewSet

router = DefaultRouter()
router.register(r"orders", PurchaseOrderViewSet)
router.register(r"receipts", PurchaseReceiptViewSet)
router.register(r"returns", PurchaseReturnViewSet)

urlpatterns = [
    path("", include(router.urls)),
]
