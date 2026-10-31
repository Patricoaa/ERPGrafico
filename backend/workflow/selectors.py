class NotificationSelector:
    @staticmethod
    def get_queryset_for_user(user):
        from .models import Notification

        return Notification.objects.filter(user=user)

    @staticmethod
    def unread_count_for_user(user):
        return NotificationSelector.get_queryset_for_user(user).filter(read=False).count()


class TaskSelectorExt:
    @staticmethod
    def get_queryset_for_user(user):
        from django.db.models import Q

        from .models import Task
        qs = Task.objects.all()
        if user.is_superuser:
            return qs
        q = (
            Q(assigned_to=user)
            | Q(assigned_group__in=user.groups.all())
            | Q(category="TASK", assigned_to__isnull=True, assigned_group__isnull=True)
            | Q(created_by=user)
        )
        return qs.filter(q).distinct()
