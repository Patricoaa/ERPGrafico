from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PaymentViewSet, TreasuryAccountViewSet


router = DefaultRouter()
router.register(r'payments', PaymentViewSet)
router.register(r'accounts', TreasuryAccountViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
