from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .subscription_views import SubscriptionViewSet
from .views import (
    CategoryViewSet,
    InventoryCountViewSet,
    PricingRuleViewSet,
    ProductAttributeValueViewSet,
    ProductAttributeViewSet,
    ProductUoMPriceViewSet,
    ProductViewSet,
    StockMoveViewSet,
    UoMCategoryViewSet,
    UoMViewSet,
    WarehouseViewSet,
    InventoryDocumentViewSet,
)

router = DefaultRouter()
router.register(r"products", ProductViewSet, basename="product")
router.register(r"categories", CategoryViewSet, basename="category")
router.register(r"warehouses", WarehouseViewSet, basename="warehouse")
router.register(r"moves", StockMoveViewSet, basename="stockmove")
router.register(r"uoms", UoMViewSet, basename="uom")
router.register(r"uom-categories", UoMCategoryViewSet, basename="uomcategory")
router.register(r"pricing-rules", PricingRuleViewSet, basename="pricingrule")
router.register(r"subscriptions", SubscriptionViewSet, basename="subscription")
router.register(r"attributes", ProductAttributeViewSet, basename="productattribute")
router.register(r"attribute-values", ProductAttributeValueViewSet, basename="productattributevalue")
router.register(r"uom-prices", ProductUoMPriceViewSet, basename="uom-prices")
router.register(r"documents", InventoryDocumentViewSet, basename="inventorydocument")
router.register(r"counts", InventoryCountViewSet, basename="inventorycount")

urlpatterns = [
    path("", include(router.urls)),
]
