from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AccountingPeriodViewSet,
    F29DeclarationViewSet,
    F29PaymentViewSet,
    TaxPeriodViewSet,
)

router = DefaultRouter()
router.register(r"periods", TaxPeriodViewSet, basename="taxperiod")
router.register(r"accounting-periods", AccountingPeriodViewSet, basename="accountingperiod")
router.register(r"declarations", F29DeclarationViewSet, basename="f29declaration")
router.register(r"payments", F29PaymentViewSet, basename="f29payment")

urlpatterns = [
    path("", include(router.urls)),
]
