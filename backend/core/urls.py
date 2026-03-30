from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UserViewSet, CompanySettingsViewSet, ActionLogViewSet, GlobalAuditLogView,
    CurrentUserView, MyProfileView, ChangePasswordView, ChangePinView, GroupViewSet, server_time,
    MyProfilePayrollPreviewView
)

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'groups', GroupViewSet)
router.register(r'company', CompanySettingsViewSet)
router.register(r'action-logs', ActionLogViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('auth/me/', CurrentUserView.as_view(), name='current-user'),
    path('auth/my-profile/', MyProfileView.as_view(), name='my-profile'),
    path('auth/my-profile/payrolls/<int:payroll_id>/preview/', MyProfilePayrollPreviewView.as_view(), name='my-profile-payroll-preview'),
    path('auth/change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('auth/change-pin/', ChangePinView.as_view(), name='change-pin'),
    path('audit/global/', GlobalAuditLogView.as_view(), name='global-audit-log'),
    path('server-time/', server_time, name='server-time'),
]
