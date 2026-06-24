from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import BillOfMaterialsViewSet, WorkOrderViewSet

router = DefaultRouter()
router.register(r"orders", WorkOrderViewSet)
router.register(r"boms", BillOfMaterialsViewSet)
urlpatterns = [
    path("", include(router.urls)),
]
