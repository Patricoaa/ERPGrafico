from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TaxPeriodViewSet, F29DeclarationViewSet, F29PaymentViewSet

router = DefaultRouter()
router.register(r'periods', TaxPeriodViewSet, basename='taxperiod')
router.register(r'declarations', F29DeclarationViewSet, basename='f29declaration')
router.register(r'payments', F29PaymentViewSet, basename='f29payment')

urlpatterns = [
    path('', include(router.urls)),
]
