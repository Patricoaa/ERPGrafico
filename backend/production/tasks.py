import logging

from celery import shared_task
from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.utils import timezone

from workflow.models import Notification, Task

from .models import WorkOrder

logger = logging.getLogger(__name__)


@shared_task(
    bind=True, autoretry_for=(Exception,), retry_kwargs={"max_retries": 3}, retry_backoff=True
)
def notify_overdue_work_orders(self):
    """
    Tarea horaria que revisa OTs atrasadas y notifica al usuario asignado.
    Criterios: due_date < today AND status NOT IN (FINISHED, CANCELLED).
    Máximo 1 notificación por día por OT.
    """
    today = timezone.now().date()

    overdue_ots = list(
        WorkOrder.objects.filter(estimated_completion_date__lt=today).exclude(
            status__in=[WorkOrder.Status.FINISHED, WorkOrder.Status.CANCELLED]
        )
    )
    if not overdue_ots:
        logger.info("notify_overdue_work_orders: Generated 0 notifications.")
        return 0

    ct_workorder = ContentType.objects.get_for_model(WorkOrder)
    ot_ids = [ot.id for ot in overdue_ots]

    # Batch the reads: one query for today's notifications, one for active task assignees.
    # Previously each OT issued its own exists() and Task query (Θ(n) round-trips).
    already_notified = set(
        Notification.objects.filter(
            content_type=ct_workorder,
            notification_type="OT_OVERDUE",
            created_at__date=today,
            object_id__in=ot_ids,
        ).values_list("object_id", flat=True)
    )
    assignees_by_ot: dict[int, set[int]] = {}
    for object_id, assigned_to_id in Task.objects.filter(
        content_type=ct_workorder,
        object_id__in=ot_ids,
        status__in=[Task.Status.PENDING, Task.Status.IN_PROGRESS],
        assigned_to__isnull=False,
    ).values_list("object_id", "assigned_to_id"):
        assignees_by_ot.setdefault(object_id, set()).add(assigned_to_id)

    notified_count = 0

    for ot in overdue_ots:
        if ot.id in already_notified:
            continue
        users_to_notify = assignees_by_ot.get(ot.id)
        if not users_to_notify:
            continue
        # Notification.create (not bulk_create): post_save pushes each one in real time.
        with transaction.atomic():
            for user_id in users_to_notify:
                Notification.objects.create(
                    user_id=user_id,
                    title=f"OT Atrasada: {ot.display_id}",
                    message=f"La Orden de Trabajo {ot.display_id} - {ot.description} debía finalizar el {ot.estimated_completion_date.strftime('%d/%m/%Y')}.",
                    type=Notification.Type.WARNING,
                    notification_type="OT_OVERDUE",
                    content_type=ct_workorder,
                    object_id=ot.id,
                    link=f"/production/orders?selected={ot.id}",
                )
                notified_count += 1

    logger.info(f"notify_overdue_work_orders: Generated {notified_count} notifications.")
    return notified_count
