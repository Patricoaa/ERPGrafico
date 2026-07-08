from core.api.pagination import StandardResultsSetPagination
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Notification, NotificationRule, Task, TaskAssignmentRule, WorkflowSettings
from .selectors import NotificationSelector
from .serializers import (
    NotificationRuleSerializer,
    NotificationSerializer,
    TaskAssignmentRuleSerializer,
    TaskSerializer,
    WorkflowSettingsSerializer,
)
from .services import WorkflowService


class TaskViewSet(viewsets.ModelViewSet):
    pagination_class = StandardResultsSetPagination
    """
    Manage system tasks.
    Standard users see only their assigned tasks or tasks they created.
    Admins see all.
    """

    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "priority", "task_type", "assigned_to", "category"]
    search_fields = ["title", "description"]
    ordering_fields = ["created_at", "priority", "due_date"]

    def get_queryset(self):
        from .selectors import TaskSelectorExt
        return TaskSelectorExt.get_queryset_for_user(self.request.user)

    def perform_update(self, serializer):
        instance = self.get_object()
        WorkflowService.finalize_task_update(instance, serializer, self.request.user)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        task = self.get_object()
        try:
            WorkflowService.complete_task(
                task=task,
                user=request.user,
                notes=request.data.get("notes"),
                files=request.FILES.getlist("attachments"),
            )
            return Response({"status": "completed"})
        except PermissionDenied as e:
            return Response({"error": str(e)}, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class NotificationViewSet(viewsets.ModelViewSet):
    pagination_class = StandardResultsSetPagination
    """
    Manage user notifications.
    Users only see their own notifications.
    """

    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return NotificationSelector.get_queryset_for_user(self.request.user)

    @action(detail=False, methods=["post"])
    def mark_all_read(self, request):
        WorkflowService.mark_all_notifications_read(self.request.user)
        return Response({"status": "marked_read"})

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        WorkflowService.mark_notification_read(notification=notif)
        return Response({"status": "read"})

    @action(detail=False, methods=["get"])
    def unread_count(self, request):
        return Response({"count": NotificationSelector.unread_count_for_user(self.request.user)})


class TaskAssignmentRuleViewSet(viewsets.ModelViewSet):
    """
    Manage assignment rules.
    Only admins should edit this, but authenticated users might need to read?
    For now, restrict to admins or users with specific permission.
    """

    queryset = TaskAssignmentRule.objects.all()
    serializer_class = TaskAssignmentRuleSerializer
    pagination_class = None  # Master data
    permission_classes = [IsAuthenticated]  # Should refine to specific permission later


class WorkflowSettingsViewSet(viewsets.ModelViewSet):
    """
    Manage global workflow settings (Singleton).
    """

    queryset = WorkflowSettings.objects.all()
    serializer_class = WorkflowSettingsSerializer
    permission_classes = [IsAuthenticated]  # Should refine to specific permission later

    def get_object(self):
        return WorkflowSettings.get_settings()

    @action(detail=False, methods=["get", "put", "patch"])
    def current(self, request):
        settings = self.get_object()
        if request.method == "GET":
            serializer = self.get_serializer(settings)
            return Response(serializer.data)

        serializer = self.get_serializer(
            settings, data=request.data, partial=(request.method == "PATCH")
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class NotificationRuleViewSet(viewsets.ModelViewSet):
    """
    Manage notification rules.
    Only admins should edit this.
    """

    queryset = NotificationRule.objects.all()
    serializer_class = NotificationRuleSerializer
    pagination_class = None  # Master data
    permission_classes = [IsAuthenticated]  # Should refine to specific permission later
