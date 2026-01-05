from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ServiceCategoryViewSet, 
    ServiceContractViewSet, 
    ServiceObligationViewSet
)

router = DefaultRouter()
router.register(r'categories', ServiceCategoryViewSet)
router.register(r'contracts', ServiceContractViewSet)
router.register(r'obligations', ServiceObligationViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
