from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import MethodNotAllowed, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.api.pagination import StandardResultsSetPagination
from core.api.permissions import StandardizedModelPermissions

from .models import ApprovalPolicy, NotificationRule, TaskAssignmentRule, WorkflowSettings
from .selectors import NotificationSelector
from .serializers import (
    ApprovalPolicySerializer,
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
    permission_classes = [IsAuthenticated, StandardizedModelPermissions]
    action_permissions = {
        "complete": "workflow.change_task",
        "reject": "workflow.change_task",
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "priority", "task_type", "assigned_to", "category"]
    search_fields = ["title", "description"]
    ordering_fields = ["created_at", "priority", "due_date"]

    def get_queryset(self):
        from .selectors import TaskSelectorExt
        return TaskSelectorExt.get_queryset_for_user(self.request.user)

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            return [IsAuthenticated()]
        return super().get_permissions()

    def perform_update(self, serializer):
        instance = self.get_object()
        WorkflowService.finalize_task_update(instance, serializer, self.request.user)

    def create(self, request, *args, **kwargs):
        raise MethodNotAllowed("POST", detail="Las tareas se crean desde los flujos de negocio.")

    def destroy(self, request, *args, **kwargs):
        raise MethodNotAllowed("DELETE", detail="Las tareas y su historial de aprobación no se pueden eliminar.")

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        task = self.get_object()
        try:
            completed = WorkflowService.complete_task(
                task=task,
                user=request.user,
                notes=request.data.get("notes"),
                files=request.FILES.getlist("attachments"),
                confirmations=_parse_confirmations(request.data.get("confirmations")),
            )
            return Response({
                "status": completed.status.lower(),
                "approvals_received": completed.approvals_received,
                "approvals_required": completed.approvals_required,
            })
        except PermissionDenied as e:
            return Response({"error": str(e)}, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        task = self.get_object()
        try:
            WorkflowService.reject_task(task=task, user=request.user, notes=request.data.get("notes"))
            return Response({"status": "rejected", "approvals_received": 0, "approvals_required": 1})
        except PermissionDenied as e:
            return Response({"error": str(e)}, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


def _parse_confirmations(raw):
    """`confirmations` arrives as a JSON object string in the multipart body."""
    import json

    if not raw:
        return {}
    if isinstance(raw, dict):
        return raw
    try:
        value = json.loads(raw)
    except (TypeError, ValueError):
        return {}
    return value if isinstance(value, dict) else {}


class NotificationViewSet(viewsets.ModelViewSet):
    pagination_class = StandardResultsSetPagination
    """
    Manage user notifications.
    Users only see their own notifications.
    """

    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]  # Personal inbox: row-level filtering in selector (ADR-0104)
    action_permissions = {
        # Personal actions → None (row-level filtering in selector)
        "mark_read": None,
        "mark_all_read": None,
    }

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

    queryset = TaskAssignmentRule.objects.select_related("assigned_user", "assigned_group").all()
    serializer_class = TaskAssignmentRuleSerializer
    pagination_class = None  # Master data


class WorkflowSettingsViewSet(viewsets.ModelViewSet):
    """
    Manage global workflow settings (Singleton).
    """

    queryset = WorkflowSettings.objects.all()
    serializer_class = WorkflowSettingsSerializer
    action_permissions = {
        # current: explicit per-verb — view_* (read) / change_* (manage, via OVERRIDES ADR-0116)
        "current": None,
    }

    def get_permissions(self):
        if self.action == "current":
            from core.api.permissions import require_perms
            verb = "view" if self.request.method in ("GET", "HEAD", "OPTIONS") else "change"
            return [require_perms(f"workflow.{verb}_workflowsettings")()]
        return super().get_permissions()

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


class ApprovalPolicyViewSet(viewsets.ModelViewSet):
    """Manage approval policies for document types."""

    queryset = ApprovalPolicy.objects.all()
    serializer_class = ApprovalPolicySerializer
    pagination_class = None

    action_permissions: dict = {}
