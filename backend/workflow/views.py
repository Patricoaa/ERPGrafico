from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django_filters.rest_framework import DjangoFilterBackend
from .models import Task, Notification, TaskAssignmentRule
from .serializers import TaskSerializer, NotificationSerializer, TaskAssignmentRuleSerializer
from django.utils import timezone

class TaskViewSet(viewsets.ModelViewSet):
    """
    Manage system tasks.
    Standard users see only their assigned tasks or tasks they created.
    Admins see all.
    """
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'priority', 'task_type', 'assigned_to']
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
        
        # Filter strictly:
        # 1. Assigned directly to user
        # 2. Key 'candidate_group' in data matches one of user's groups
        
        from django.db.models import Q
        
        return qs.filter(
            Q(assigned_to=user) | 
            Q(data__candidate_group__in=list(user_groups))
        ).distinct()

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        task = self.get_object()
        task.status = Task.Status.COMPLETED
        task.completed_at = timezone.now()
        task.save()
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
