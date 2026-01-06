from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AccountViewSet, JournalEntryViewSet, AccountingSettingsViewSet, BudgetViewSet, BudgetItemViewSet

router = DefaultRouter()
router.register(r'accounts', AccountViewSet)
router.register(r'entries', JournalEntryViewSet)
router.register(r'settings', AccountingSettingsViewSet)
router.register(r'budgets', BudgetViewSet)
router.register(r'budget-items', BudgetItemViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
