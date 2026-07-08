from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    BankLoanViewSet,
    BankStatementLineViewSet,
    BankStatementViewSet,
    BankViewSet,
    CheckViewSet,
    CreditCardStatementViewSet,
    CreditLineViewSet,
    LoanInstallmentViewSet,
    PaymentMethodViewSet,
    PaymentTerminalDeviceViewSet,
    PaymentTerminalProviderViewSet,
    POSSessionViewSet,
    POSTerminalViewSet,
    ReconciliationSettingsViewSet,
    TerminalBatchViewSet,
    TreasuryAccountViewSet,
    TreasuryDashboardViewSet,
    TreasuryMovementViewSet,
)

router = DefaultRouter()
router.register(r"movements", TreasuryMovementViewSet, basename="treasury-movement")
router.register(r"payments", TreasuryMovementViewSet, basename="treasury-payment")
router.register(r"accounts", TreasuryAccountViewSet, basename="treasuryaccount")
router.register(r"pos-terminals", POSTerminalViewSet, basename="posterminal")
router.register(r"banks", BankViewSet, basename="bank")
router.register(r"payment-methods", PaymentMethodViewSet, basename="paymentmethod")
router.register(r"terminal-batches", TerminalBatchViewSet, basename="terminalbatch")
router.register(r"terminal-providers", PaymentTerminalProviderViewSet, basename="terminalprovider")
router.register(r"terminal-devices", PaymentTerminalDeviceViewSet, basename="terminaldevice")

router.register(r"statements", BankStatementViewSet, basename="bankstatement")
router.register(r"statement-lines", BankStatementLineViewSet, basename="bankstatementline")
router.register(r"reconciliation-settings", ReconciliationSettingsViewSet, basename="reconciliationsettings")

router.register(r"pos-sessions", POSSessionViewSet, basename="possession")
router.register(r"dashboard", TreasuryDashboardViewSet, basename="treasury-dashboard")
router.register(r"checks", CheckViewSet, basename="check")
router.register(r"loans", BankLoanViewSet, basename="bankloan")
router.register(r"loan-installments", LoanInstallmentViewSet, basename="loaninstallment")
router.register(r"credit-lines", CreditLineViewSet, basename="creditline")
router.register(r"card-statements", CreditCardStatementViewSet, basename="creditcardstatement")

urlpatterns = [
    path("", include(router.urls)),
]
