from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .rcv_views import (
    RCVApiKeyViewSet,
    RCVDocumentViewSet,
    RCVImportViewSet,
    RCVSettingsViewSet,
)
from .views import (
    AccountingSettingsViewSet,
    AccountViewSet,
    BudgetItemViewSet,
    BudgetViewSet,
    FiscalYearViewSet,
    JournalEntryViewSet,
)

router = DefaultRouter()
router.register(r"accounts", AccountViewSet, basename="account")
router.register(r"entries", JournalEntryViewSet, basename="journalentry")
router.register(r"settings", AccountingSettingsViewSet, basename="accountingsettings")
router.register(r"budgets", BudgetViewSet, basename="budget")
router.register(r"budget-items", BudgetItemViewSet, basename="budgetitem")
router.register(r"fiscal-years", FiscalYearViewSet, basename="fiscalyear")
router.register(r"rcv-documents", RCVDocumentViewSet, basename="rcvdocument")
router.register(r"rcv-imports", RCVImportViewSet, basename="rcvimport")
router.register(r"rcv-settings", RCVSettingsViewSet, basename="rcvsettings")
router.register(r"rcv-api-keys", RCVApiKeyViewSet, basename="rcvapikey")

urlpatterns = [
    path("", include(router.urls)),
]
