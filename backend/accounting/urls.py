from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AccountViewSet, JournalEntryViewSet, AccountingSettingsViewSet

router = DefaultRouter()
router.register(r'accounts', AccountViewSet)
router.register(r'entries', JournalEntryViewSet)
router.register(r'settings', AccountingSettingsViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
