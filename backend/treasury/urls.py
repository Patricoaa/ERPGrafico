from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PaymentViewSet, TreasuryAccountViewSet,
    BankStatementViewSet, BankStatementLineViewSet,
    ReconciliationRuleViewSet
)


router = DefaultRouter()
router.register(r'payments', PaymentViewSet)
router.register(r'accounts', TreasuryAccountViewSet)
router.register(r'statements', BankStatementViewSet)
router.register(r'statement-lines', BankStatementLineViewSet)
router.register(r'reconciliation-rules', ReconciliationRuleViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
