import logging
from celery import shared_task
from django.utils import timezone
from django.db import transaction
from django.contrib.contenttypes.models import ContentType
from .models import WorkOrder
from workflow.models import Task, Notification

logger = logging.getLogger(__name__)

@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_kwargs={'max_retries': 3},
    retry_backoff=True
)
def notify_overdue_work_orders(self):
    """
    Tarea horaria que revisa OTs atrasadas y notifica al usuario asignado.
    Criterios: due_date < today AND status NOT IN (FINISHED, CANCELLED).
    Máximo 1 notificación por día por OT.
    """
    today = timezone.now().date()
    
    overdue_ots = WorkOrder.objects.filter(
        estimated_completion_date__lt=today
    ).exclude(
        status__in=[WorkOrder.Status.FINISHED, WorkOrder.Status.CANCELLED]
    )
    
    ct_workorder = ContentType.objects.get_for_model(WorkOrder)
    
    notified_count = 0
    
    for ot in overdue_ots:
        # Check if we already notified today
        already_notified = Notification.objects.filter(
            content_type=ct_workorder,
            object_id=ot.id,
            notification_type='OT_OVERDUE',
            created_at__date=today
        ).exists()
        
        if already_notified:
            continue
            
        active_tasks = Task.objects.filter(
            content_type=ct_workorder,
            object_id=ot.id,
            status__in=[Task.Status.PENDING, Task.Status.IN_PROGRESS]
        )
        
        users_to_notify = set()
        for task in active_tasks:
            if task.assigned_to:
                users_to_notify.add(task.assigned_to)
                
        if users_to_notify:
            with transaction.atomic():
                for user in users_to_notify:
                    Notification.objects.create(
                        user=user,
                        title=f"OT Atrasada: {ot.display_id}",
                        message=f"La Orden de Trabajo {ot.display_id} - {ot.description} debía finalizar el {ot.estimated_completion_date.strftime('%d/%m/%Y')}.",
                        type=Notification.Type.WARNING,
                        notification_type='OT_OVERDUE',
                        content_type=ct_workorder,
                        object_id=ot.id,
                        link=f"/production/orders?selected={ot.id}"
                    )
                    notified_count += 1
                
    logger.info(f"notify_overdue_work_orders: Generated {notified_count} notifications.")
