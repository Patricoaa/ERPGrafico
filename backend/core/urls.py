from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserViewSet, CompanySettingsViewSet, ActionLogViewSet, GlobalAuditLogView
from .dashboard_view import DashboardMetricsView

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'company', CompanySettingsViewSet)
router.register(r'action-logs', ActionLogViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('dashboard/metrics/', DashboardMetricsView.as_view(), name='dashboard-metrics'),
    path('audit/global/', GlobalAuditLogView.as_view(), name='global-audit-log'),
]
