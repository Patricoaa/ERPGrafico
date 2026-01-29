from django.utils import timezone
from .models import Task, Notification, TaskAssignmentRule

class WorkflowService:
    """
    Central service to handle business logic for Workflows.
    """

    @staticmethod
    def get_assignee_for_task_type(task_type):
        """
        Finds the user or group assigned to this task type.
        Returns dict with keys 'user', 'group' or None.
        """
        try:
            rule = TaskAssignmentRule.objects.get(task_type=task_type)
            return {
                'user': rule.assigned_user,
                'group': rule.assigned_group
            }
        except TaskAssignmentRule.DoesNotExist:
            return None

    @staticmethod
    def create_task(task_type, title, description, content_object=None, priority=Task.Priority.MEDIUM, created_by=None, data=None, category=Task.Category.APPROVAL):
        """
        Creates a new task.
        If rule specifies a user, assigned_to is set.
        If rule specifies a group, assigned_to is None, but data['candidate_group'] is set (Pool Assignment).
        
        category: APPROVAL (default) for workflow approvals, TASK for operational tasks
        """
        assignee_info = WorkflowService.get_assignee_for_task_type(task_type)
        assigned_user = None
        candidate_group = None

        if assignee_info:
            assigned_user = assignee_info.get('user')
            candidate_group = assignee_info.get('group')

        # If data is None initialize it
        task_data = data or {}
        
        # If pool assignment (Group but no User)
        if candidate_group and not assigned_user:
            task_data['candidate_group'] = candidate_group
        
        task = Task.objects.create(
            title=title,
            description=description,
            task_type=task_type,
            priority=priority,
            created_by=created_by,
            assigned_to=assigned_user,
            content_object=content_object,
            data=task_data,
            category=category
        )
        
        if assigned_user:
            WorkflowService.notify_assignment(task)
        elif candidate_group:
            WorkflowService.notify_group_assignment(task, candidate_group)
            
        return task

    @staticmethod
    def _get_link_for_task(task):
        """
        Generate smart links based on content object.
        """
        if task.content_type and task.content_object:
            model_name = task.content_type.model
            if model_name == 'workorder':
                return f"/production/orders/{task.object_id}"
            # Add other models here (e.g. saleorder, purchaseorder)
            
        return f"/workflow/tasks/{task.id}"

    @staticmethod
    def notify_group_assignment(task, group_name):
        """
        Notify all users in the specific group about a new unassigned task (Pool).
        """
        from django.contrib.auth.models import Group
        try:
            group = Group.objects.get(name=group_name)
            users = group.user_set.all()
            
            link = WorkflowService._get_link_for_task(task)
            
            for user in users:
                Notification.objects.create(
                    user=user,
                    title=f"Disponible: {task.title}",
                    message=f"Nueva tarea para {group_name}. Estado: Pendiente",
                    type=Notification.Type.INFO,
                    link=link,
                    content_object=task
                )
        except Group.DoesNotExist:
            pass

    @staticmethod
    def notify_assignment(task):
        """
        Creates an in-app notification for the user assigned to the task.
        """
        if not task.assigned_to:
            return

        link = WorkflowService._get_link_for_task(task)

        Notification.objects.create(
            user=task.assigned_to,
            title=f"Asignación: {task.title}",
            message=f"{task.description or task.task_type}. Estado: Pendiente",
            type=Notification.Type.INFO,
            link=link,
            content_object=task
        )

    @staticmethod
    def auto_complete_approval_tasks(content_object, user):
        """
        Auto-completes all pending approval tasks for a given object.
        Called during state transitions (e.g., WorkOrder advances to next stage).
        
        Args:
            content_object: The object (WorkOrder, SaleOrder, etc.) being transitioned
            user: The user performing the transition (for audit trail)
        """
        from django.contrib.contenttypes.models import ContentType
        from django.utils import timezone
        
        content_type = ContentType.objects.get_for_model(content_object)
        
        # Find all pending approval tasks for this object
        pending_approvals = Task.objects.filter(
            content_type=content_type,
            object_id=content_object.pk,
            category=Task.Category.APPROVAL,
            status=Task.Status.PENDING
        )
        
        for task in pending_approvals:
            task.status = Task.Status.COMPLETED
            task.completed_at = timezone.now()
            task.completed_by = user
            task.save()
            
            # Notify the assignee (if any) that the task was completed
            if task.assigned_to:
                Notification.objects.create(
                    user=task.assigned_to,
                    title=f"Aprobación Completada: {task.title}",
                    message=f"Aprobada por {user.username}",
                    type=Notification.Type.SUCCESS,
                    link=WorkflowService._get_link_for_task(task),
                    content_object=task
                )

    @staticmethod
    def reset_tasks_for_object(content_object, stage_ids=None):
        """
        Resets completed approval tasks for a given object to PENDING.
        If stage_ids is provided, only tasks matching those stages (via task_type) are reset.
        """
        from django.contrib.contenttypes.models import ContentType
        
        content_type = ContentType.objects.get_for_model(content_object)
        
        query = Task.objects.filter(
            content_type=content_type,
            object_id=content_object.pk,
            category=Task.Category.APPROVAL,
            status=Task.Status.COMPLETED
        )
        
        # We assume OT_STAGE_ID_APPROVAL is the task type pattern
        if stage_ids:
            # Create a list of task types to match
            task_types = [f"OT_{stage}_APPROVAL" for stage in stage_ids]
            query = query.filter(task_type__in=task_types)
            
        reset_count = query.update(
            status=Task.Status.PENDING,
            completed_at=None,
            completed_by=None
        )
        return reset_count
