from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import WorkOrderViewSet, BillOfMaterialsViewSet, BillOfMaterialsLineViewSet

router = DefaultRouter()
router.register(r'orders', WorkOrderViewSet)
router.register(r'boms', BillOfMaterialsViewSet)
router.register(r'bom-lines', BillOfMaterialsLineViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
