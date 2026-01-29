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
    def create_task(task_type, title, description, content_object=None, priority=Task.Priority.MEDIUM, created_by=None, data=None):
        """
        Creates a new task.
        If rule specifies a user, assigned_to is set.
        If rule specifies a group, assigned_to is None, but data['candidate_group'] is set (Pool Assignment).
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
            data=task_data
        )
        
        if assigned_user:
            WorkflowService.notify_assignment(task)
        elif candidate_group:
            WorkflowService.notify_group_assignment(task, candidate_group)
            
        return task

    @staticmethod
    def notify_group_assignment(task, group_name):
        """
        Notify all users in the specific group about a new unassigned task (Pool).
        """
        from django.contrib.auth.models import Group
        try:
            group = Group.objects.get(name=group_name)
            users = group.user_set.all()
            
            link = f"/workflow/tasks/{task.id}"
            
            for user in users:
                Notification.objects.create(
                    user=user,
                    title=f"Nueva Tarea de Grupo: {task.title}",
                    message=f"Tarea disponible para {group_name}: {task.description or task.task_type}",
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

        link = f"/workflow/tasks/{task.id}" # Simplified link, frontend to handle redirection
        
        # Smart link generation based on content object could happen here
        if task.content_type and task.content_object:
            # Example: /production/orders/123
            # This logic might need to be extensible
            pass

        Notification.objects.create(
            user=task.assigned_to,
            title=f"Nueva Tarea: {task.title}",
            message=f"Se te ha asignado la tarea: {task.description or task.task_type}",
            type=Notification.Type.INFO,
            link=link,
            content_object=task
        )
