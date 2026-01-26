from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SaleOrderViewSet, SalesSettingsViewSet, SaleDeliveryViewSet, SaleReturnViewSet

router = DefaultRouter()
router.register(r'orders', SaleOrderViewSet)
router.register(r'settings', SalesSettingsViewSet)
router.register(r'deliveries', SaleDeliveryViewSet)
router.register(r'returns', SaleReturnViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
