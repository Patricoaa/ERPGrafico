from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserViewSet, CompanySettingsViewSet
from .dashboard_view import DashboardMetricsView

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'company', CompanySettingsViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('dashboard/metrics/', DashboardMetricsView.as_view(), name='dashboard-metrics'),
]
