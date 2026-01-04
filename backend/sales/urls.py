from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SaleOrderViewSet, SalesSettingsViewSet, SaleDeliveryViewSet

router = DefaultRouter()
router.register(r'orders', SaleOrderViewSet)
router.register(r'settings', SalesSettingsViewSet)
router.register(r'deliveries', SaleDeliveryViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
