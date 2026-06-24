from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AbsenceViewSet,
    AFPViewSet,
    EmployeeConceptAmountViewSet,
    EmployeeViewSet,
    GlobalHRSettingsViewSet,
    PayrollConceptViewSet,
    PayrollItemViewSet,
    PayrollPaymentViewSet,
    PayrollViewSet,
    SalaryAdvanceViewSet,
)

router = DefaultRouter()
router.register(r"global-settings", GlobalHRSettingsViewSet, basename="hr-global-settings")
router.register(r"afps", AFPViewSet, basename="afps")
router.register(r"concepts", PayrollConceptViewSet, basename="hr-concepts")
router.register(r"employees", EmployeeViewSet, basename="employees")
router.register(
    r"employee-concept-amounts", EmployeeConceptAmountViewSet, basename="employee-concept-amounts"
)
router.register(r"payrolls", PayrollViewSet, basename="payrolls")
router.register(r"absences", AbsenceViewSet, basename="absences")
router.register(r"advances", SalaryAdvanceViewSet, basename="advances")
router.register(r"payroll-payments", PayrollPaymentViewSet, basename="payroll-payments")

# Nested payroll items under /payrolls/{payroll_pk}/items/
payroll_items_router = DefaultRouter()
payroll_items_router.register(r"items", PayrollItemViewSet, basename="payroll-items")

urlpatterns = [
    path("", include(router.urls)),
    path("payrolls/<int:payroll_pk>/", include(payroll_items_router.urls)),
]
