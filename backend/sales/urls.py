from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CustomerViewSet, SaleOrderViewSet, SalesSettingsViewSet

router = DefaultRouter()
router.register(r'customers', CustomerViewSet)
router.register(r'orders', SaleOrderViewSet)
router.register(r'settings', SalesSettingsViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
