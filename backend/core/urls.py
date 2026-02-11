from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserViewSet, CompanySettingsViewSet, ActionLogViewSet, GlobalAuditLogView, CurrentUserView, GroupViewSet, server_time
# from .dashboard_view import DashboardMetricsView  # Deleted

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'groups', GroupViewSet)
router.register(r'company', CompanySettingsViewSet)
router.register(r'action-logs', ActionLogViewSet)

urlpatterns = [
    path('', include(router.urls)),
    # path('dashboard/metrics/', DashboardMetricsView.as_view(), name='dashboard-metrics'),  # Removed
    path('auth/me/', CurrentUserView.as_view(), name='current-user'),
    path('audit/global/', GlobalAuditLogView.as_view(), name='global-audit-log'),
    path('server-time/', server_time, name='server-time'),
]
