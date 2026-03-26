from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.exceptions import PermissionDenied
from django_filters.rest_framework import DjangoFilterBackend
from .models import Task, Notification, TaskAssignmentRule, WorkflowSettings, NotificationRule
from .serializers import (
    TaskSerializer, NotificationSerializer, TaskAssignmentRuleSerializer,
    WorkflowSettingsSerializer, NotificationRuleSerializer
)
from .services import WorkflowService
from django.utils import timezone
from purchasing.models import PurchaseOrder

class TaskViewSet(viewsets.ModelViewSet):
    """
    Manage system tasks.
    Standard users see only their assigned tasks or tasks they created.
    Admins see all.
    """
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'priority', 'task_type', 'assigned_to', 'category']
    search_fields = ['title', 'description']
    ordering_fields = ['created_at', 'priority', 'due_date']

    def get_queryset(self):
        user = self.request.user
        # Create a base queryset
        qs = Task.objects.all()
        
        # If user is superuser, return all
        if user.is_superuser:
            return qs
            
        # Get user's groups
        user_groups = user.groups.values_list('name', flat=True)
        
        # Filter:
        # 1. Assigned directly to user
        # 2. Key 'candidate_group' in data matches one of user's groups
        # 3. Assigned group matches one of user's groups
        # 4. TASK-category tasks with no assignment (visible to all)
        
        from django.db.models import Q
        
        return qs.filter(
            Q(assigned_to=user) | 
            Q(assigned_group__in=user.groups.all()) |
            Q(data__candidate_group__in=list(user_groups)) |
            Q(category='TASK', assigned_to__isnull=True, assigned_group__isnull=True) |
            Q(created_by=user)
        ).distinct()

    def perform_update(self, serializer):
        instance = self.get_object()
        old_status = instance.status
        
        updated_task = serializer.save()
        
        if old_status != updated_task.status and updated_task.status in [Task.Status.COMPLETED, Task.Status.REJECTED]:
            if not updated_task.completed_by:
                updated_task.completed_by = self.request.user
                updated_task.completed_at = timezone.now()
                updated_task.save(update_fields=['completed_by', 'completed_at'])
            
            if updated_task.status == Task.Status.COMPLETED and updated_task.category == Task.Category.APPROVAL and updated_task.created_by and updated_task.task_type == 'CREDIT_POS_REQUEST':
                draft_id = updated_task.data.get('request_data', {}).get('draft_id')
                link = f"/sales/pos?draftId={draft_id}" if draft_id else "/sales/pos"
                WorkflowService.send_notification(
                    notification_type='POS_CREDIT_APPROVAL',
                    title=f"Aprobación de Crédito Completada: {updated_task.title}",
                    message="La solicitud de crédito ha sido aprobada y está lista para ser procesada en el POS.",
                    link=link,
                    creator=updated_task.created_by,
                    level=Notification.Type.SUCCESS
                )
            elif updated_task.status == Task.Status.REJECTED and updated_task.category == Task.Category.APPROVAL and updated_task.created_by and updated_task.task_type == 'CREDIT_POS_REQUEST':
                WorkflowService.send_notification(
                    notification_type='POS_CREDIT_APPROVAL',
                    title=f"Aprobación de Crédito Rechazada: {updated_task.title}",
                    message="La solicitud de crédito para el POS ha sido rechazada.",
                    link="/sales/pos",
                    creator=updated_task.created_by,
                    level=Notification.Type.ERROR
                )

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        task = self.get_object()
        
        # HUB stage tasks can only be auto-completed by the system
        if task.category == Task.Category.TASK and task.task_type.startswith('HUB_'):
            return Response(
                {'error': 'Las tareas de etapa del HUB se completan automáticamente al finalizar la etapa correspondiente.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Security Check: Can this user complete this task?
        if not request.user.is_superuser:
            if task.assigned_to and task.assigned_to != request.user:
                raise PermissionDenied("No tienes permisos para completar esta tarea asignada a otro usuario.")
            
            if task.assigned_group and not request.user.groups.filter(id=task.assigned_group.id).exists():
                raise PermissionDenied(f"No tienes permisos para completar esta tarea. Debes pertenecer al grupo '{task.assigned_group.name}'.")

        task.status = Task.Status.COMPLETED
        task.completed_at = timezone.now()
        task.completed_by = request.user
        
        # Save notes if provided
        notes = request.data.get('notes')
        if notes:
            task.notes = notes
            
        task.save()
        
        # Handle attachments if provided
        files = request.FILES.getlist('attachments')
        if files:
            from core.models import Attachment
            from django.contrib.contenttypes.models import ContentType
            task_ct = ContentType.objects.get_for_model(Task)
            for f in files:
                Attachment.objects.create(
                    file=f,
                    original_filename=f.name,
                    content_type=task_ct,
                    object_id=task.id,
                    user=request.user
                )
        # Create notification if it's an approval task related to POS credit and has a creator
        if task.category == Task.Category.APPROVAL and task.created_by and task.task_type == 'CREDIT_POS_REQUEST':
            # Para las solicitudes de crédito desde POS, el draft_id puede venir en data (si se guardó) o no haber link
            draft_id = task.data.get('request_data', {}).get('draft_id')
            link = f"/sales/pos?draftId={draft_id}" if draft_id else "/sales/pos"
            WorkflowService.send_notification(
                notification_type='POS_CREDIT_APPROVAL',
                user=task.created_by,
                title=f"Aprobación de Crédito Completada: {task.title}",
                message="La solicitud de crédito ha sido aprobada y está lista para ser procesada en el POS.",
                level=Notification.Type.SUCCESS,
                link=link
            )
            
        return Response({'status': 'completed'})

class NotificationViewSet(viewsets.ModelViewSet):
    """
    Manage user notifications.
    Users only see their own notifications.
    """
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        self.get_queryset().filter(read=False).update(read=True)
        return Response({'status': 'marked_read'})
    
    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        notif.read = True
        notif.save()
        return Response({'status': 'read'})
    
    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        count = self.get_queryset().filter(read=False).count()
        return Response({'count': count})

class TaskAssignmentRuleViewSet(viewsets.ModelViewSet):
    """
    Manage assignment rules.
    Only admins should edit this, but authenticated users might need to read? 
    For now, restrict to admins or users with specific permission.
    """
    queryset = TaskAssignmentRule.objects.all()
    serializer_class = TaskAssignmentRuleSerializer
    permission_classes = [IsAuthenticated] # Should refine to specific permission later


class WorkflowSettingsViewSet(viewsets.ModelViewSet):
    """
    Manage global workflow settings (Singleton).
    """
    queryset = WorkflowSettings.objects.all()
    serializer_class = WorkflowSettingsSerializer
    permission_classes = [IsAuthenticated] # Should refine to specific permission later

    def get_object(self):
        return WorkflowSettings.get_settings()

    @action(detail=False, methods=['get', 'put', 'patch'])
    def current(self, request):
        settings = self.get_object()
        if request.method == 'GET':
            serializer = self.get_serializer(settings)
            return Response(serializer.data)
        
        serializer = self.get_serializer(settings, data=request.data, partial=(request.method == 'PATCH'))
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
    permission_classes = [IsAuthenticated] # Should refine to specific permission later
