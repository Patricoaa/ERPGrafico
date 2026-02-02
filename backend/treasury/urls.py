from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PaymentViewSet, TreasuryAccountViewSet,
    BankStatementViewSet, BankStatementLineViewSet,
    ReconciliationRuleViewSet, ReconciliationReportsViewSet,
    CardBillingViewSet
)


router = DefaultRouter()
router.register(r'payments', PaymentViewSet)
router.register(r'accounts', TreasuryAccountViewSet)
router.register(r'statements', BankStatementViewSet)
router.register(r'statement-lines', BankStatementLineViewSet)
router.register(r'reconciliation-rules', ReconciliationRuleViewSet)
router.register(r'reconciliation-reports', ReconciliationReportsViewSet, basename='reconciliation-reports')
router.register(r'card-billing', CardBillingViewSet, basename='card-billing')

urlpatterns = [
    path('', include(router.urls)),
]
