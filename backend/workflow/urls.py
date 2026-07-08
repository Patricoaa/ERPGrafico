from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    NotificationRuleViewSet,
    NotificationViewSet,
    TaskAssignmentRuleViewSet,
    TaskViewSet,
    WorkflowSettingsViewSet,
)

router = DefaultRouter()
router.register(r"tasks", TaskViewSet, basename="task")
router.register(r"notifications", NotificationViewSet, basename="notification")
router.register(r"assignment-rules", TaskAssignmentRuleViewSet, basename="assignment-rule")
router.register(r"settings", WorkflowSettingsViewSet, basename="workflow-settings")
router.register(r"notification-rules", NotificationRuleViewSet, basename="notification-rule")

urlpatterns = [
    path("", include(router.urls)),
]
