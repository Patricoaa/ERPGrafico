from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import WorkOrderViewSet, BillOfMaterialsViewSet

router = DefaultRouter()
router.register(r'orders', WorkOrderViewSet)
router.register(r'boms', BillOfMaterialsViewSet)
urlpatterns = [
    path('', include(router.urls)),
]
