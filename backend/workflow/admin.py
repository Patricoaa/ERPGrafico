from django.contrib import admin
from .models import Task, Notification, TaskAssignmentRule

@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ('title', 'task_type', 'status', 'priority', 'assigned_to', 'created_at')
    list_filter = ('status', 'priority', 'task_type')
    search_fields = ('title', 'description')

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'type', 'read', 'created_at')
    list_filter = ('type', 'read')
    search_fields = ('title', 'user__username')

@admin.register(TaskAssignmentRule)
class TaskAssignmentRuleAdmin(admin.ModelAdmin):
    list_display = ('task_type', 'assigned_user', 'description')
    search_fields = ('task_type', 'assigned_user__username')
