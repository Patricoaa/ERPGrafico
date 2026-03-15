from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SaleOrderViewSet, SalesSettingsViewSet, SaleDeliveryViewSet, SaleReturnViewSet
from .draft_cart_views import DraftCartViewSet

from .pricing_views import PricingViewSet

router = DefaultRouter()
router.register(r'orders', SaleOrderViewSet)
router.register(r'settings', SalesSettingsViewSet)
router.register(r'deliveries', SaleDeliveryViewSet)
router.register(r'returns', SaleReturnViewSet)
router.register(r'pos-drafts', DraftCartViewSet, basename='pos-draft')
router.register(r'pricing', PricingViewSet, basename='pricing')

urlpatterns = [
    path('credit_history/', SaleOrderViewSet.as_view({'get': 'credit_history'}), name='credit-history'),
    path('', include(router.urls)),
]
