from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ProductViewSet, CategoryViewSet, WarehouseViewSet, StockMoveViewSet,
    UoMViewSet, UoMCategoryViewSet, PricingRuleViewSet,
    ProductAttributeViewSet, ProductAttributeValueViewSet,
    ProductUoMPriceViewSet
)
from .subscription_views import SubscriptionViewSet


router = DefaultRouter()
router.register(r'products', ProductViewSet)
router.register(r'categories', CategoryViewSet)
router.register(r'warehouses', WarehouseViewSet)
router.register(r'moves', StockMoveViewSet)
router.register(r'uoms', UoMViewSet)
router.register(r'uom-categories', UoMCategoryViewSet)
router.register(r'pricing-rules', PricingRuleViewSet)
router.register(r'subscriptions', SubscriptionViewSet)
router.register(r'attributes', ProductAttributeViewSet)
router.register(r'attribute-values', ProductAttributeValueViewSet)
router.register(r'uom-prices', ProductUoMPriceViewSet, basename='uom-prices')

urlpatterns = [
    path('', include(router.urls)),
]
