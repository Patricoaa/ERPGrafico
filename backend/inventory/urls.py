from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ProductViewSet, CategoryViewSet, WarehouseViewSet, StockMoveViewSet, 
    UoMViewSet, UoMCategoryViewSet, PricingRuleViewSet,
    CustomFieldTemplateViewSet, ProductCustomFieldViewSet, ReorderingRuleViewSet
)

router = DefaultRouter()
router.register(r'products', ProductViewSet)
router.register(r'categories', CategoryViewSet)
router.register(r'warehouses', WarehouseViewSet)
router.register(r'moves', StockMoveViewSet)
router.register(r'uoms', UoMViewSet)
router.register(r'uom-categories', UoMCategoryViewSet)
router.register(r'pricing-rules', PricingRuleViewSet)
router.register(r'custom-field-templates', CustomFieldTemplateViewSet)
router.register(r'product-custom-fields', ProductCustomFieldViewSet)
router.register(r'reordering-rules', ReorderingRuleViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
