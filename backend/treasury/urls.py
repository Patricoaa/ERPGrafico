from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    TreasuryMovementViewSet, TreasuryAccountViewSet, POSTerminalViewSet,
    BankStatementViewSet, BankStatementLineViewSet,
    ReconciliationSettingsViewSet, ReconciliationReportsViewSet,
    POSSessionViewSet, 
    TreasuryDashboardViewSet,
    BankViewSet, PaymentMethodViewSet, TerminalBatchViewSet,
    PaymentTerminalProviderViewSet, PaymentTerminalDeviceViewSet
)

router = DefaultRouter()
router.register(r'movements', TreasuryMovementViewSet, basename='treasury-movement')
router.register(r'payments', TreasuryMovementViewSet, basename='treasury-payment')
router.register(r'accounts', TreasuryAccountViewSet)
router.register(r'pos-terminals', POSTerminalViewSet)
router.register(r'banks', BankViewSet)
router.register(r'payment-methods', PaymentMethodViewSet)
router.register(r'terminal-batches', TerminalBatchViewSet)
router.register(r'terminal-providers', PaymentTerminalProviderViewSet)
router.register(r'terminal-devices', PaymentTerminalDeviceViewSet)

router.register(r'statements', BankStatementViewSet)
router.register(r'statement-lines', BankStatementLineViewSet)
router.register(r'reconciliation-settings', ReconciliationSettingsViewSet)
router.register(r'reconciliation-reports', ReconciliationReportsViewSet, basename='reconciliation-reports')

router.register(r'pos-sessions', POSSessionViewSet, basename='possession')
router.register(r'dashboard', TreasuryDashboardViewSet, basename='treasury-dashboard')

urlpatterns = [
    path('', include(router.urls)),
]
