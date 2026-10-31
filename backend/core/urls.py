from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .api.documents import document_ref, document_relations
from .api.rbac import catalog_view, bundles_view
from .api.search import universal_search
from .views import (
    ActionLogViewSet,
    BackgroundJobViewSet,
    ChangePasswordView,
    ChangePinView,
    CompanySettingsViewSet,
    CurrentUserView,
    GlobalAuditLogView,
    GroupViewSet,
    MyProfilePayrollPreviewView,
    MyProfileView,
    UserPreferenceView,
    UserViewSet,
    entity_config,
    entity_prefixes,
    server_time,
    system_status,
)

router = DefaultRouter()
router.register(r"users", UserViewSet, basename="user")
router.register(r"groups", GroupViewSet, basename="group")
router.register(r"company", CompanySettingsViewSet, basename="companysettings")
router.register(r"action-logs", ActionLogViewSet, basename="actionlog")
router.register(r"jobs", BackgroundJobViewSet, basename="jobs")

urlpatterns = [
    path("", include(router.urls)),
    path("auth/me/", CurrentUserView.as_view(), name="current-user"),
    path("auth/my-profile/", MyProfileView.as_view(), name="my-profile"),
    path(
        "auth/my-profile/payrolls/<int:payroll_id>/preview/",
        MyProfilePayrollPreviewView.as_view(),
        name="my-profile-payroll-preview",
    ),
    path("auth/change-password/", ChangePasswordView.as_view(), name="change-password"),
    path("auth/change-pin/", ChangePinView.as_view(), name="change-pin"),
    path("audit/global/", GlobalAuditLogView.as_view(), name="global-audit-log"),
    path("server-time/", server_time, name="server-time"),
    path("status/", system_status, name="system-status"),
    path("entity-prefixes/", entity_prefixes, name="entity-prefixes"),
    path("entity-config/", entity_config, name="entity-config"),
    path("preferences/", UserPreferenceView.as_view(), name="user-preferences"),
    path("search/", universal_search, name="universal-search"),
    path("permissions/catalog/", catalog_view, name="permissions-catalog"),
    path("permissions/bundles/", bundles_view, name="permissions-bundles"),
    # ADR-0080: DocumentRef y relaciones (label = app.model)
    path("documents/<str:label>/<int:pk>/", document_ref, name="document-ref"),
    path("documents/<str:label>/<int:pk>/relations/", document_relations, name="document-relations"),
]
