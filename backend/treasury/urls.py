from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PaymentViewSet, TreasuryAccountViewSet, TuuPaymentView, TuuStatusView


router = DefaultRouter()
router.register(r'payments', PaymentViewSet)
router.register(r'accounts', TreasuryAccountViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('tuu/initiate/', TuuPaymentView.as_view(), name='tuu-initiate'),
    path('tuu/status/<str:idempotency_key>/', TuuStatusView.as_view(), name='tuu-status'),
]
