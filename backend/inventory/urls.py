from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProductViewSet, CategoryViewSet, WarehouseViewSet, StockMoveViewSet, ProductAttributeViewSet, ProductAttributeValueViewSet

router = DefaultRouter()
router.register(r'products', ProductViewSet)
router.register(r'categories', CategoryViewSet)
router.register(r'warehouses', WarehouseViewSet)
router.register(r'moves', StockMoveViewSet)
router.register(r'attributes', ProductAttributeViewSet)
router.register(r'attribute-values', ProductAttributeValueViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
