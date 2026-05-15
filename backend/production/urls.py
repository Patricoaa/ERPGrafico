from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import WorkOrderViewSet, BillOfMaterialsViewSet, BillOfMaterialsLineViewSet, WorkOrderTemplateViewSet

router = DefaultRouter()
router.register(r'orders', WorkOrderViewSet)
router.register(r'boms', BillOfMaterialsViewSet)
router.register(r'bom-lines', BillOfMaterialsLineViewSet)
router.register(r'templates', WorkOrderTemplateViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
