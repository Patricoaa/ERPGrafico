from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TaskViewSet, NotificationViewSet, TaskAssignmentRuleViewSet, WorkflowSettingsViewSet

router = DefaultRouter()
router.register(r'tasks', TaskViewSet, basename='task')
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'assignment-rules', TaskAssignmentRuleViewSet, basename='assignment-rule')
router.register(r'settings', WorkflowSettingsViewSet, basename='workflow-settings')

urlpatterns = [
    path('', include(router.urls)),
]
