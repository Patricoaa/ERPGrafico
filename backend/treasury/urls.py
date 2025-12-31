from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BankJournalViewSet, PaymentViewSet

router = DefaultRouter()
router.register(r'journals', BankJournalViewSet)
router.register(r'payments', PaymentViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
