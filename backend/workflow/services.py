from django.utils import timezone
from .models import Task, Notification, TaskAssignmentRule

class WorkflowService:
    """
    Central service to handle business logic for Workflows.
    """

    @staticmethod
    def get_assignee_for_task_type(task_type):
        """
        Finds the user assigned to this task type.
        Returns None if no rule matches.
        """
        try:
            rule = TaskAssignmentRule.objects.get(task_type=task_type)
            return rule.assigned_user
        except TaskAssignmentRule.DoesNotExist:
            return None

    @staticmethod
    def create_task(task_type, title, description, content_object=None, priority=Task.Priority.MEDIUM, created_by=None, data=None):
        """
        Creates a new task, assigns it based on rules, and notifies the assignee.
        """
        assignee = WorkflowService.get_assignee_for_task_type(task_type)
        
        # If no explicit assignee via rule, we might want to fail hard or leave it unassigned?
        # For now, create it unassigned but log warning? Or maybe fallback to admin?
        # Requirement: "Usuarios especificos con la posibilidad de configurar"
        # If unassigned, it sits in limbo.
        
        task = Task.objects.create(
            title=title,
            description=description,
            task_type=task_type,
            priority=priority,
            created_by=created_by,
            assigned_to=assignee,
            content_object=content_object,
            data=data or {}
        )
        
        if assignee:
            WorkflowService.notify_assignment(task)
            
        return task

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
