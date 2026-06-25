class TaskSelectorExt:
    @staticmethod
    def get_queryset_for_user(user):
        from .models import Task
        from django.db.models import Q
        qs = Task.objects.all()
        if user.is_superuser: return qs
        ug = list(user.groups.values_list('name', flat=True))
        q = Q(assigned_to=user) | Q(assigned_group__in=user.groups.all()) | Q(data__candidate_group__in=ug) | Q(category='TASK', assigned_to__isnull=True, assigned_group__isnull=True) | Q(created_by=user)
        return qs.filter(q).distinct()
